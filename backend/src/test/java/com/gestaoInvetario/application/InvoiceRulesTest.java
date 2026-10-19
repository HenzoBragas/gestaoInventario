package com.gestaoInvetario.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gestaoInvetario.application.repositories.LocationRepository;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Notas fiscais: cadastro, validacoes, permissoes e anexo da NF-e. */
@SpringBootTest
@AutoConfigureMockMvc
class InvoiceRulesTest {

    private static final byte[] PDF = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF".getBytes(StandardCharsets.US_ASCII);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired LocationRepository locations;

    String admin;
    int adminId;
    int product;

    @BeforeEach
    void setUp() throws Exception {
        admin = login("inventario", "inventario123");
        adminId = json(call(admin, get("/auth/me"), null)).get("id").asInt();
        int category = json(call(admin, post("/categories"), Map.of("name", "Cat " + UUID.randomUUID().toString().substring(0, 8))))
                .get("seq").asInt();
        Map<String, Object> body = new HashMap<>();
        body.put("sku", "NF-" + System.nanoTime());
        body.put("name", "Produto com nota");
        body.put("categoryId", category);
        body.put("unit", "UN");
        body.put("unitCost", 10);
        body.put("minStock", 1);
        body.put("defaultLocationId", locations.findByCodeIgnoreCase("DEP-01").orElseThrow().getId());
        body.put("initialQuantity", 0);
        product = json(call(admin, post("/products"), body)).get("id").asInt();
    }

    @Test
    void cadastraEditaListaEExcluiNota() throws Exception {
        JsonNode created = json(call(admin, post("/invoices"), invoice("NF-123", "1500.90")));
        int id = created.get("id").asInt();
        assertThat(created.get("productId").asInt()).isEqualTo(product);
        assertThat(created.get("employeeId").asInt()).isEqualTo(adminId);
        assertThat(created.get("fileName").isNull()).isTrue();

        Map<String, Object> changed = invoice("NF-123-A", "99.10");
        changed.put("purchasePlace", "Loja Centro");
        JsonNode updated = json(call(admin, put("/invoices/" + id), changed));
        assertThat(updated.get("number").asText()).isEqualTo("NF-123-A");
        assertThat(updated.get("amount").decimalValue()).isEqualByComparingTo("99.10");
        assertThat(updated.get("purchasePlace").asText()).isEqualTo("Loja Centro");

        JsonNode page = json(call(admin, get("/invoices").param("productId", String.valueOf(product)), null));
        assertThat(page.get("totalItems").asInt()).isEqualTo(1);
        JsonNode search = json(call(admin, get("/invoices").param("q", "loja centro"), null));
        assertThat(search.get("items").findValuesAsText("number")).contains("NF-123-A");

        call(admin, delete("/invoices/" + id), null);
        perform(admin, get("/invoices/" + id), null).andExpect(status().isNotFound());
    }

    @Test
    void validaCamposObrigatoriosEValor() throws Exception {
        Map<String, Object> body = invoice(" ", "0");
        perform(admin, post("/invoices"), body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.number").exists())
                .andExpect(jsonPath("$.fieldErrors.amount").exists());

        Map<String, Object> unknownProduct = invoice("NF-1", "10");
        unknownProduct.put("productId", 999_999);
        perform(admin, post("/invoices"), unknownProduct)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.productId").exists());
    }

    @Test
    void visualizadorConsultaMasNaoAltera() throws Exception {
        String username = "viewer" + System.nanoTime();
        call(admin, post("/users"), Map.of("username", username, "name", "Visualizador", "role", "VIEWER",
                "password", "senha-forte-123"));
        String viewer = login(username, "senha-forte-123");

        perform(viewer, get("/invoices"), null).andExpect(status().isOk());
        perform(viewer, get("/employees"), null).andExpect(status().isOk());
        perform(viewer, post("/invoices"), invoice("NF-9", "10")).andExpect(status().isForbidden());
    }

    @Test
    void anexaBaixaERemoveArquivo() throws Exception {
        int id = json(call(admin, post("/invoices"), invoice("NF-ANEXO", "10"))).get("id").asInt();

        // Nome com caminho e caracteres especiais e normalizado; o tipo vem do conteudo.
        JsonNode attached = json(upload(id, "../../segredo/nota fiscal?.pdf", PDF).andExpect(status().isOk()).andReturn());
        assertThat(attached.get("fileName").asText()).isEqualTo("nota fiscal_.pdf");
        assertThat(attached.get("fileType").asText()).isEqualTo("application/pdf");
        assertThat(attached.get("fileSize").asInt()).isEqualTo(PDF.length);

        MvcResult file = call(admin, get("/invoices/" + id + "/file"), null);
        assertThat(file.getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(file.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION)).startsWith("attachment;");
        assertThat(file.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");

        // Executavel renomeado para .pdf e recusado.
        upload(id, "nota.pdf", "MZ\u0090\u0000".getBytes(StandardCharsets.ISO_8859_1))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("FILE_TYPE"));

        call(admin, delete("/invoices/" + id + "/file"), null);
        perform(admin, get("/invoices/" + id + "/file"), null).andExpect(status().isNotFound());
    }

    @Test
    void produtoComNotaNaoPodeSerExcluido() throws Exception {
        call(admin, post("/invoices"), invoice("NF-PROD", "10"));
        perform(admin, delete("/products/" + product), null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PRODUCT_HAS_INVOICES"));
    }

    // ------------------------------------------------------------------ apoio

    private Map<String, Object> invoice(String number, String amount) {
        Map<String, Object> body = new HashMap<>();
        body.put("number", number);
        body.put("purchasePlace", "Distribuidora Exemplo");
        body.put("amount", amount);
        body.put("paymentDate", "2026-10-15");
        body.put("productId", product);
        body.put("employeeId", adminId);
        return body;
    }

    private ResultActions upload(int id, String name, byte[] content) throws Exception {
        return mvc.perform(multipart(HttpMethod.PUT, "/invoices/" + id + "/file")
                .file(new MockMultipartFile("file", name, "application/octet-stream", content))
                .header("Authorization", "Bearer " + admin));
    }

    private String login(String username, String password) throws Exception {
        MvcResult result = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("username", username, "password", password))))
                .andExpect(status().isOk()).andReturn();
        return json(result).get("token").asText();
    }

    private ResultActions perform(String token, MockHttpServletRequestBuilder builder, Object body) throws Exception {
        builder.header("Authorization", "Bearer " + token);
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        }
        return mvc.perform(builder);
    }

    private MvcResult call(String token, MockHttpServletRequestBuilder builder, Object body) throws Exception {
        MvcResult result = perform(token, builder, body).andReturn();
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isBetween(200, 299);
        return result;
    }

    private JsonNode json(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString());
    }
}
