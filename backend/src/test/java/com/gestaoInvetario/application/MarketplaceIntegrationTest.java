package com.gestaoInvetario.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gestaoInvetario.application.integration.ExternalOrder;
import com.gestaoInvetario.application.integration.ExternalOrder.Item;
import com.gestaoInvetario.application.integration.ExternalOrder.State;
import com.gestaoInvetario.application.integration.MercadoLivreClient;
import com.gestaoInvetario.application.integration.ShopeeClient;
import com.gestaoInvetario.application.model.Marketplace;
import com.gestaoInvetario.application.model.MarketplaceOrder;
import com.gestaoInvetario.application.model.MarketplaceOrderStatus;
import com.gestaoInvetario.application.repositories.LocationRepository;
import com.gestaoInvetario.application.repositories.MarketplaceOrderRepository;
import com.gestaoInvetario.application.repositories.StockBalanceRepository;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Fluxo completo webhook -> fila -> worker assincrono -> baixa de estoque. As APIs dos marketplaces
 * sao simuladas (fetchOrder); assinatura da Shopee, fila, idempotencia e baixa sao os reais.
 */
@SpringBootTest(properties = {
        "app.marketplace.mercadolivre.enabled=true",
        "app.marketplace.mercadolivre.seller-id=555",
        "app.marketplace.shopee.enabled=true",
        "app.marketplace.shopee.partner-key=test-partner-key",
        "app.marketplace.shopee.push-url=https://example.test/integrations/webhooks/shopee",
        "app.marketplace.shopee.shop-id=777",
        "app.marketplace.worker.initial-delay-ms=600000"
})
@AutoConfigureMockMvc
class MarketplaceIntegrationTest {

    private static final String PUSH_URL = "https://example.test/integrations/webhooks/shopee";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired LocationRepository locations;
    @Autowired StockBalanceRepository balances;
    @Autowired MarketplaceOrderRepository orders;

    @MockitoBean MercadoLivreClient mercadoLivre;
    @MockitoSpyBean ShopeeClient shopee;

    String admin;
    int dep;
    int loja;
    int category;

    @BeforeEach
    void setUp() throws Exception {
        admin = login();
        dep = locations.findByCodeIgnoreCase("DEP-01").orElseThrow().getId();
        loja = locations.findByCodeIgnoreCase("LOJ-01").orElseThrow().getId();
        category = json(call(post("/categories"), Map.of("name", "Cat " + UUID.randomUUID().toString().substring(0, 8))))
                .get("seq").asInt();
    }

    @Test
    void paidMercadoLivreOrderDecrementsStockOnlyOnce() throws Exception {
        String sku = newSku();
        int product = createProduct(sku, 10);
        String orderId = newMlOrderId();
        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.PAID, "paid", new Item(sku, "Cabo", 3)));

        mlWebhook(orderId, 555).andExpect(status().isOk());
        MarketplaceOrder done = awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.DONE);

        assertThat(stock(product)).isEqualTo(7);
        assertThat(done.getSummary()).isEqualTo("3x " + sku);

        // Notificacoes seguintes do mesmo pedido (envio, entrega...) nao baixam de novo.
        mlWebhook(orderId, 555).andExpect(status().isOk());
        mlWebhook(orderId, 555).andExpect(status().isOk());
        Thread.sleep(300);
        assertThat(stock(product)).isEqualTo(7);
        assertThat(movementsWithReference("Mercado Livre #" + orderId)).isEqualTo(1);
    }

    @Test
    void concurrentNotificationsOfSameOrderAllSucceedAndDecrementOnce() throws Exception {
        String sku = newSku();
        int product = createProduct(sku, 10);
        String orderId = newMlOrderId();
        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.PAID, "paid", new Item(sku, "X", 2)));

        ExecutorService pool = Executors.newFixedThreadPool(10);
        try {
            List<Future<Integer>> calls = new ArrayList<>();
            for (int i = 0; i < 10; i++) {
                calls.add(pool.submit(() -> mlWebhook(orderId, 555).andReturn().getResponse().getStatus()));
            }
            for (Future<Integer> call : calls) {
                assertThat(call.get()).isEqualTo(200); // nenhum conflito vira erro 500
            }
        } finally {
            pool.shutdown();
        }
        MarketplaceOrder done = awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.DONE);
        Thread.sleep(500); // deixa terminar eventuais reprocessamentos pedidos pelos avisos concorrentes
        // Avisos que chegam durante o processamento podem pedir UMA releitura, nunca uma por aviso.
        assertThat(orders.findById(done.getId()).orElseThrow().getAttempts()).isLessThanOrEqualTo(2);
        assertThat(stock(product)).isEqualTo(8);
        assertThat(movementsWithReference("Mercado Livre #" + orderId)).isEqualTo(1);
    }

    @Test
    void waitsForPaymentAndProcessesWhenPaidNotificationArrives() throws Exception {
        String sku = newSku();
        int product = createProduct(sku, 5);
        String orderId = newMlOrderId();
        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.AWAITING_PAYMENT, "payment_required", new Item(sku, "X", 2)));

        mlWebhook(orderId, 555).andExpect(status().isOk());
        awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.IGNORED);
        assertThat(stock(product)).isEqualTo(5);

        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.PAID, "paid", new Item(sku, "X", 2)));
        mlWebhook(orderId, 555).andExpect(status().isOk());
        awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.DONE);
        assertThat(stock(product)).isEqualTo(3);
    }

    @Test
    void unknownSkuFailsWithoutTouchingStockAndCanBeRetried() throws Exception {
        String sku = newSku();
        int product = createProduct(sku, 5);
        String orderId = newMlOrderId();
        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.PAID, "paid",
                new Item(sku, "Conhecido", 1), new Item("NAO-EXISTE", "Desconhecido", 1)));

        mlWebhook(orderId, 555).andExpect(status().isOk());
        MarketplaceOrder failed = awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.FAILED);

        assertThat(failed.getLastError()).contains("NAO-EXISTE");
        assertThat(failed.getNextAttemptAt()).isNotNull();
        assertThat(stock(product)).isEqualTo(5); // tudo ou nada: o item conhecido tambem nao saiu

        // Corrigido o anuncio, o gerente reprocessa.
        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.PAID, "paid", new Item(sku, "Conhecido", 1)));
        call(post("/integrations/orders/" + failed.getId() + "/retry"), null);
        awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.DONE);
        assertThat(stock(product)).isEqualTo(4);
    }

    @Test
    void insufficientStockFailsInsteadOfGoingNegative() throws Exception {
        String sku = newSku();
        int product = createProduct(sku, 1);
        String orderId = newMlOrderId();
        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.PAID, "paid", new Item(sku, "X", 2)));

        mlWebhook(orderId, 555).andExpect(status().isOk());
        MarketplaceOrder failed = awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.FAILED);

        assertThat(failed.getLastError()).contains("Saldo insuficiente");
        assertThat(stock(product)).isEqualTo(1);
    }

    @Test
    void takesFromDefaultLocationFirstThenFromOthers() throws Exception {
        String sku = newSku();
        int product = createProduct(sku, 7); // tudo em DEP-01 (padrao)
        Map<String, Object> transfer = new HashMap<>();
        transfer.put("type", "TRANSFER");
        transfer.put("productId", product);
        transfer.put("quantity", 5);
        transfer.put("fromLocationId", dep);
        transfer.put("toLocationId", loja);
        transfer.put("reason", "Teste");
        call(post("/movements"), transfer); // DEP-01: 2, LOJ-01: 5

        String orderId = newMlOrderId();
        when(mercadoLivre.fetchOrder(orderId)).thenReturn(order(orderId, State.PAID, "paid", new Item(sku, "X", 4)));
        mlWebhook(orderId, 555).andExpect(status().isOk());
        awaitStatus(Marketplace.MERCADO_LIVRE, orderId, MarketplaceOrderStatus.DONE);

        assertThat(balance(product, dep)).isZero();
        assertThat(balance(product, loja)).isEqualTo(3);
        assertThat(stock(product)).isEqualTo(3);
    }

    @Test
    void ignoresNotificationsFromOtherSellers() throws Exception {
        String orderId = newMlOrderId();
        mlWebhook(orderId, 999).andExpect(status().isOk());
        assertThat(orders.findByMarketplaceAndExternalOrderId(Marketplace.MERCADO_LIVRE, orderId)).isEmpty();
    }

    @Test
    void shopeePushRequiresValidSignature() throws Exception {
        String sku = newSku();
        int product = createProduct(sku, 4);
        String orderSn = "SHP" + System.nanoTime();
        doReturn(order(orderSn, State.PAID, "READY_TO_SHIP", new Item(sku, "Mouse", 2))).when(shopee).fetchOrder(orderSn);
        String body = "{\"data\":{\"ordersn\":\"" + orderSn + "\",\"status\":\"READY_TO_SHIP\"},\"shop_id\":777,\"code\":3,\"timestamp\":1}";

        mvc.perform(post("/integrations/webhooks/shopee").contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "assinatura-falsa").content(body))
                .andExpect(status().isUnauthorized());
        assertThat(orders.findByMarketplaceAndExternalOrderId(Marketplace.SHOPEE, orderSn)).isEmpty();

        mvc.perform(post("/integrations/webhooks/shopee").contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", hmac("test-partner-key", PUSH_URL + "|" + body)).content(body))
                .andExpect(status().isOk());
        awaitStatus(Marketplace.SHOPEE, orderSn, MarketplaceOrderStatus.DONE);
        assertThat(stock(product)).isEqualTo(2);
    }

    @Test
    void orderListRequiresManager() throws Exception {
        mvc.perform(get("/integrations/orders")).andExpect(status().isUnauthorized());
        JsonNode page = json(call(get("/integrations/orders?status=DONE"), null));
        assertThat(page.has("items")).isTrue();
    }

    // ------------------------------------------------------------------ helpers

    private static ExternalOrder order(String id, State state, String raw, Item... items) {
        return new ExternalOrder(id, state, raw, List.of(items));
    }

    private org.springframework.test.web.servlet.ResultActions mlWebhook(String orderId, long userId) throws Exception {
        String body = mapper.writeValueAsString(Map.of("resource", "/orders/" + orderId, "user_id", userId,
                "topic", "orders_v2", "application_id", 1, "attempts", 1));
        return mvc.perform(post("/integrations/webhooks/mercadolivre").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private MarketplaceOrder awaitStatus(Marketplace marketplace, String orderId, MarketplaceOrderStatus expected)
            throws InterruptedException {
        MarketplaceOrder order = null;
        for (int i = 0; i < 100; i++) {
            order = orders.findByMarketplaceAndExternalOrderId(marketplace, orderId).orElse(null);
            if (order != null && order.getStatus() == expected) {
                return order;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("Pedido " + orderId + " nao chegou a " + expected + "; status atual: "
                + (order == null ? "inexistente" : order.getStatus() + " / " + order.getLastError()));
    }

    private static String newMlOrderId() {
        return String.valueOf(2_000_000_000_000L + System.nanoTime() % 1_000_000_000_000L);
    }

    private static String newSku() {
        return "MKT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private int createProduct(String sku, int initialQuantity) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("sku", sku);
        body.put("name", "Produto " + sku);
        body.put("categoryId", category);
        body.put("unit", "UN");
        body.put("unitCost", 10.5);
        body.put("minStock", 0);
        body.put("defaultLocationId", dep);
        body.put("initialQuantity", initialQuantity);
        return json(call(post("/products"), body)).get("id").asInt();
    }

    private int stock(int product) throws Exception {
        return json(call(get("/products/" + product), null)).get("stock").asInt();
    }

    private int balance(int product, int location) {
        return balances.findByProduct_IdAndLocation_Id(product, location).map(b -> b.getQuantity()).orElse(0);
    }

    private long movementsWithReference(String reference) throws Exception {
        JsonNode page = json(call(get("/movements").param("q", reference), null));
        return page.get("totalItems").asLong();
    }

    private static String hmac(String key, String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
    }

    private String login() throws Exception {
        MvcResult result = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("username", "inventario", "password", "inventario123"))))
                .andExpect(status().isOk()).andReturn();
        return json(result).get("token").asText();
    }

    private MvcResult call(MockHttpServletRequestBuilder builder, Object body) throws Exception {
        builder.header("Authorization", "Bearer " + admin);
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        }
        MvcResult result = mvc.perform(builder).andReturn();
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isBetween(200, 299);
        return result;
    }

    private JsonNode json(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString());
    }
}
