package com.gestaoInvetario.application.controllers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gestaoInvetario.application.integration.MarketplaceOrderService;
import com.gestaoInvetario.application.integration.MarketplaceProperties;
import com.gestaoInvetario.application.integration.ShopeeClient;
import com.gestaoInvetario.application.model.Marketplace;
import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Webhooks publicos chamados pelos marketplaces. Apenas enfileiram o pedido e respondem 200 na hora
 * (o Mercado Livre exige resposta em ~500 ms); a baixa de estoque acontece no worker assincrono.
 * Se responder erro, o marketplace reenvia a notificacao mais tarde.
 */
@RestController
@RequestMapping("/integrations/webhooks")
public class MarketplaceWebhookController {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceWebhookController.class);
    private static final Pattern ML_ORDER_RESOURCE = Pattern.compile("^/orders/(\\d+)$");
    /** Shopee push code 3 = mudanca de status do pedido (order_status_push). */
    private static final int SHOPEE_ORDER_STATUS_PUSH = 3;

    private final MarketplaceOrderService orders;
    private final MarketplaceProperties properties;
    private final ShopeeClient shopee;
    private final ObjectMapper mapper;

    public MarketplaceWebhookController(MarketplaceOrderService orders, MarketplaceProperties properties,
                                        ShopeeClient shopee, ObjectMapper mapper) {
        this.orders = orders;
        this.properties = properties;
        this.shopee = shopee;
        this.mapper = mapper;
    }

    /** Corpo: {"resource":"/orders/2000001234","user_id":123,"topic":"orders_v2",...} */
    @PostMapping("/mercadolivre")
    public ResponseEntity<Void> mercadoLivre(@RequestBody JsonNode body) {
        MarketplaceProperties.MercadoLivre config = properties.mercadolivre();
        if (!config.enabled()) {
            return ResponseEntity.notFound().build();
        }
        String topic = body.path("topic").asText("");
        Matcher resource = ML_ORDER_RESOURCE.matcher(body.path("resource").asText(""));
        if (!topic.startsWith("orders") || !resource.matches()) {
            return ResponseEntity.ok().build(); // outros topicos (perguntas, itens...) nao interessam
        }
        if (config.sellerId() != null && body.path("user_id").asLong() != config.sellerId()) {
            log.warn("Notificacao do Mercado Livre de outro vendedor ignorada: user_id={}", body.path("user_id").asText());
            return ResponseEntity.ok().build();
        }
        orders.enqueue(Marketplace.MERCADO_LIVRE, resource.group(1));
        return ResponseEntity.ok().build();
    }

    /** Corpo: {"data":{"ordersn":"2411...","status":"READY_TO_SHIP"},"shop_id":123,"code":3,"timestamp":...} */
    @PostMapping("/shopee")
    public ResponseEntity<Void> shopee(@RequestBody(required = false) String rawBody,
                                       @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        MarketplaceProperties.Shopee config = properties.shopee();
        if (!config.enabled()) {
            return ResponseEntity.notFound().build();
        }
        // A assinatura cobre o corpo exato recebido, por isso ele e lido como texto antes do parse.
        if (!shopee.isValidPush(rawBody, authorization)) {
            log.warn("Push da Shopee com assinatura invalida recusado.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        JsonNode body;
        try {
            body = mapper.readTree(rawBody == null ? "{}" : rawBody);
        } catch (IOException e) {
            return ResponseEntity.badRequest().build();
        }
        if (body.path("code").asInt() != SHOPEE_ORDER_STATUS_PUSH) {
            return ResponseEntity.ok().build();
        }
        if (config.shopId() != null && body.path("shop_id").asLong() != config.shopId()) {
            log.warn("Push da Shopee de outra loja ignorado: shop_id={}", body.path("shop_id").asText());
            return ResponseEntity.ok().build();
        }
        String orderSn = body.path("data").path("ordersn").asText("");
        if (orderSn.isBlank()) {
            return ResponseEntity.ok().build();
        }
        orders.enqueue(Marketplace.SHOPEE, orderSn);
        return ResponseEntity.ok().build();
    }
}
