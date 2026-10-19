package com.gestaoInvetario.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gestaoInvetario.application.model.StockStatus;
import com.gestaoInvetario.application.repositories.LocationRepository;
import com.gestaoInvetario.application.repositories.StockBalanceRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Regras de negocio do estoque exercitadas pela API real (seguranca, validacao e transacoes).
 * O DataInitializer cria o admin "inventario" e as localizacoes DEP-01, LOJ-01 e AVA-01.
 */
@SpringBootTest
@AutoConfigureMockMvc
class InventoryRulesTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired LocationRepository locations;
    @Autowired StockBalanceRepository balances;

    String admin;
    int dep;
    int loja;
    int category;

    @BeforeEach
    void setUp() throws Exception {
        admin = login("inventario", "inventario123");
        dep = locations.findByCodeIgnoreCase("DEP-01").orElseThrow().getId();
        loja = locations.findByCodeIgnoreCase("LOJ-01").orElseThrow().getId();
        category = json(call(admin, post("/categories"), Map.of("name", "Cat " + UUID.randomUUID().toString().substring(0, 8))))
                .get("seq").asInt();
    }

    // ------------------------------------------------------------------ autenticacao e permissoes

    @Test
    void rejectsRequestsWithoutToken() throws Exception {
        mvc.perform(get("/products")).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsWrongPassword() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"inventario\",\"password\":\"errada\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void viewerCannotMoveStockAndOperatorCannotAdjust() throws Exception {
        int product = createProduct(10);
        String viewer = createUserAndLogin("VIEWER");
        String operator = createUserAndLogin("OPERATOR");

        perform(viewer, post("/movements"), movement("OUT", product, 1, dep, null)).andExpect(status().isForbidden());
        perform(viewer, post("/products"), productBody("X" + System.nanoTime(), 0)).andExpect(status().isForbidden());

        perform(operator, post("/movements"), movement("OUT", product, 1, dep, null)).andExpect(status().isCreated());
        Map<String, Object> adjust = new HashMap<>(Map.of("type", "ADJUSTMENT", "productId", product,
                "locationId", dep, "countedQuantity", 3, "reason", "Contagem"));
        perform(operator, post("/movements"), adjust).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ movimentacoes

    @Test
    void entryAndExitUpdateBalancesAndRecordBeforeAfter() throws Exception {
        int product = createProduct(10);

        JsonNode in = json(call(admin, post("/movements"), movement("IN", product, 5, null, dep)));
        assertThat(in.get("totalBefore").asInt()).isEqualTo(10);
        assertThat(in.get("totalAfter").asInt()).isEqualTo(15);
        assertThat(in.get("toBefore").asInt()).isEqualTo(10);
        assertThat(in.get("toAfter").asInt()).isEqualTo(15);

        JsonNode out = json(call(admin, post("/movements"), movement("OUT", product, 4, dep, null)));
        assertThat(out.get("delta").asInt()).isEqualTo(-4);
        assertThat(out.get("totalAfter").asInt()).isEqualTo(11);
        assertThat(stock(product)).isEqualTo(11);
        assertConsistent(product);
    }

    @Test
    void exitCannotLeaveNegativeStock() throws Exception {
        int product = createProduct(3);
        perform(admin, post("/movements"), movement("OUT", product, 4, dep, null))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
        // Saldo em outra localizacao nao pode ser usado para a saida
        perform(admin, post("/movements"), movement("OUT", product, 1, loja, null))
                .andExpect(status().isUnprocessableEntity());
        assertThat(stock(product)).isEqualTo(3);
    }

    @Test
    void transferMovesBetweenLocationsWithoutChangingTotal() throws Exception {
        int product = createProduct(8);
        JsonNode transfer = json(call(admin, post("/movements"), movement("TRANSFER", product, 3, dep, loja)));
        assertThat(transfer.get("delta").asInt()).isZero();
        assertThat(transfer.get("fromAfter").asInt()).isEqualTo(5);
        assertThat(transfer.get("toAfter").asInt()).isEqualTo(3);
        assertThat(stock(product)).isEqualTo(8);
        assertConsistent(product);

        perform(admin, post("/movements"), movement("TRANSFER", product, 1, dep, dep))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("SAME_LOCATION"));
        perform(admin, post("/movements"), movement("TRANSFER", product, 9, dep, loja))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void adjustmentSetsCountedQuantityAndRequiresDifference() throws Exception {
        int product = createProduct(10);
        Map<String, Object> adjust = new HashMap<>(Map.of("type", "ADJUSTMENT", "productId", product,
                "locationId", dep, "countedQuantity", 7, "reason", "Contagem cíclica"));
        JsonNode result = json(call(admin, post("/movements"), adjust));
        assertThat(result.get("delta").asInt()).isEqualTo(-3);
        assertThat(result.get("quantity").asInt()).isEqualTo(3);
        assertThat(stock(product)).isEqualTo(7);

        perform(admin, post("/movements"), adjust)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NO_DIFFERENCE"));

        adjust.put("reason", " ");
        adjust.put("countedQuantity", 9);
        perform(admin, post("/movements"), adjust).andExpect(status().isBadRequest());
    }

    @Test
    void sameRequestKeyIsRegisteredOnlyOnce() throws Exception {
        int product = createProduct(10);
        Map<String, Object> body = movement("OUT", product, 2, dep, null);
        body.put("requestKey", UUID.randomUUID().toString());
        long first = json(call(admin, post("/movements"), body)).get("id").asLong();
        long second = json(call(admin, post("/movements"), body)).get("id").asLong();
        assertThat(second).isEqualTo(first);
        assertThat(stock(product)).isEqualTo(8);
    }

    @Test
    void concurrentExitsNeverOversell() throws Exception {
        int product = createProduct(5);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        List<Callable<Integer>> tasks = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            tasks.add(() -> perform(admin, post("/movements"), movement("OUT", product, 1, dep, null))
                    .andReturn().getResponse().getStatus());
        }
        int created = 0;
        for (Future<Integer> f : pool.invokeAll(tasks)) {
            if (f.get() == 201) created++;
        }
        pool.shutdown();
        assertThat(created).isEqualTo(5);
        assertThat(stock(product)).isZero();
        assertConsistent(product);
    }

    // ------------------------------------------------------------------ cadastro

    @Test
    void initialQuantityIsRegisteredAsMovement() throws Exception {
        int product = createProduct(6);
        JsonNode history = json(call(admin, get("/products/" + product + "/movements"), null));
        assertThat(history.get("totalItems").asInt()).isEqualTo(1);
        assertThat(history.get("items").get(0).get("reason").asText()).isEqualTo("Saldo inicial");
    }

    @Test
    void editingProductNeverChangesStock() throws Exception {
        int product = createProduct(6);
        String sku = json(call(admin, get("/products/" + product), null)).get("sku").asText();
        Map<String, Object> body = productBody(sku, 999);
        body.put("name", "Nome editado");
        JsonNode updated = json(call(admin, put("/products/" + product), body));
        assertThat(updated.get("name").asText()).isEqualTo("Nome editado");
        assertThat(updated.get("stock").asInt()).isEqualTo(6);
    }

    @Test
    void skuMustBeUnique() throws Exception {
        String sku = "DUP-" + System.nanoTime();
        call(admin, post("/products"), productBody(sku, 0));
        perform(admin, post("/products"), productBody(sku.toLowerCase(), 0))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.fieldErrors.sku").exists());
    }

    @Test
    void inactiveProductCannotBeMovedAndCategoryInUseCannotBeDeleted() throws Exception {
        int product = createProduct(4);
        perform(admin, delete("/categories/" + category), null).andExpect(status().isConflict());
        perform(admin, delete("/products/" + product), null).andExpect(status().isConflict());

        perform(admin, org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/products/" + product + "/status"),
                Map.of("active", false)).andExpect(status().isOk());
        perform(admin, post("/movements"), movement("IN", product, 1, null, dep))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PRODUCT_INACTIVE"));
        JsonNode p = json(call(admin, get("/products/" + product), null));
        assertThat(p.get("status").asText()).isEqualTo("INACTIVE");
    }

    @Test
    void statusRule() {
        assertThat(StockStatus.of(true, 0, 5)).isEqualTo(StockStatus.OUT_OF_STOCK);
        assertThat(StockStatus.of(true, 5, 5)).isEqualTo(StockStatus.LOW_STOCK);
        assertThat(StockStatus.of(true, 6, 5)).isEqualTo(StockStatus.IN_STOCK);
        assertThat(StockStatus.of(false, 0, 5)).isEqualTo(StockStatus.INACTIVE);
    }

    @Test
    void lowStockFilterUsesProductMinimum() throws Exception {
        String marker = "LOWF" + System.nanoTime();
        Map<String, Object> body = productBody(marker, 4);
        body.put("minStock", 4);
        call(admin, post("/products"), body);
        JsonNode page = json(call(admin, get("/products?status=LOW_STOCK&q=" + marker), null));
        assertThat(page.get("totalItems").asInt()).isEqualTo(1);
        JsonNode none = json(call(admin, get("/products?status=IN_STOCK&q=" + marker), null));
        assertThat(none.get("totalItems").asInt()).isZero();
    }

    // ------------------------------------------------------------------ helpers

    private int createProduct(int initialQuantity) throws Exception {
        return json(call(admin, post("/products"), productBody("SKU-" + System.nanoTime(), initialQuantity))).get("id").asInt();
    }

    private Map<String, Object> productBody(String sku, int initialQuantity) {
        Map<String, Object> body = new HashMap<>();
        body.put("sku", sku);
        body.put("name", "Produto " + sku);
        body.put("categoryId", category);
        body.put("unit", "UN");
        body.put("unitCost", 10.5);
        body.put("minStock", 2);
        body.put("defaultLocationId", dep);
        body.put("initialQuantity", initialQuantity);
        return body;
    }

    private Map<String, Object> movement(String type, int product, int quantity, Integer from, Integer to) {
        Map<String, Object> body = new HashMap<>();
        body.put("type", type);
        body.put("productId", product);
        body.put("quantity", quantity);
        body.put("fromLocationId", from);
        body.put("toLocationId", to);
        body.put("reason", "Teste");
        return body;
    }

    private String createUserAndLogin(String role) throws Exception {
        String username = role.toLowerCase() + System.nanoTime();
        Map<String, Object> body = Map.of("username", username, "name", "Usuário " + role, "role", role,
                "password", "senha-forte-123");
        call(admin, post("/users"), body);
        return login(username, "senha-forte-123");
    }

    private int stock(int product) throws Exception {
        return json(call(admin, get("/products/" + product), null)).get("stock").asInt();
    }

    private void assertConsistent(int product) throws Exception {
        int total = balances.findByProductId(product).stream().mapToInt(b -> b.getQuantity()).sum();
        assertThat(total).isEqualTo(stock(product));
    }

    private String login(String username, String password) throws Exception {
        MvcResult result = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("username", username, "password", password))))
                .andExpect(status().isOk()).andReturn();
        return json(result).get("token").asText();
    }

    private org.springframework.test.web.servlet.ResultActions perform(String token, MockHttpServletRequestBuilder builder,
                                                                       Object body) throws Exception {
        builder.header("Authorization", "Bearer " + token);
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        }
        return mvc.perform(builder);
    }

    private MvcResult call(String token, MockHttpServletRequestBuilder builder, Object body) throws Exception {
        MvcResult result = perform(token, builder, body).andReturn();
        int code = result.getResponse().getStatus();
        assertThat(code).as(result.getResponse().getContentAsString()).isBetween(200, 299);
        return result;
    }

    private JsonNode json(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString());
    }
}
