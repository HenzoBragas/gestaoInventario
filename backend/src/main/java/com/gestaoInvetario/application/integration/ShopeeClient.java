package com.gestaoInvetario.application.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.gestaoInvetario.application.integration.ExternalOrder.Item;
import com.gestaoInvetario.application.integration.ExternalOrder.State;
import com.gestaoInvetario.application.integration.MarketplaceTokenService.Grant;
import com.gestaoInvetario.application.model.Marketplace;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Cliente da Shopee Open Platform v2. Toda chamada e assinada com HMAC-SHA256 da partner key;
 * o push (webhook) tambem chega assinado e e validado em {@link #isValidPush}.
 */
@Component
public class ShopeeClient {

    private static final Marketplace MARKETPLACE = Marketplace.SHOPEE;
    private static final String ORDER_DETAIL = "/api/v2/order/get_order_detail";
    private static final String REFRESH = "/api/v2/auth/access_token/get";

    private final MarketplaceProperties.Shopee config;
    private final MarketplaceTokenService tokens;
    private final RestClient http;

    public ShopeeClient(MarketplaceProperties properties, MarketplaceTokenService tokens, RestClient.Builder builder) {
        this.config = properties.shopee();
        this.tokens = tokens;
        this.http = MarketplaceHttp.client(builder, config.apiUrl());
    }

    /** Authorization do push = hex(HMAC-SHA256(partner_key, url_do_push + "|" + corpo)). */
    public boolean isValidPush(String rawBody, String authorization) {
        if (authorization == null || config.partnerKey() == null || config.pushUrl() == null) {
            return false;
        }
        String expected = MarketplaceHttp.hmacSha256Hex(config.partnerKey(), config.pushUrl() + "|" + (rawBody == null ? "" : rawBody));
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                authorization.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
    }

    public ExternalOrder fetchOrder(String orderSn) {
        String token = tokens.accessToken(MARKETPLACE, config.refreshToken(), this::refresh);
        long timestamp = Instant.now().getEpochSecond();
        String sign = MarketplaceHttp.hmacSha256Hex(config.partnerKey(),
                config.partnerId() + ORDER_DETAIL + timestamp + token + config.shopId());
        JsonNode body;
        try {
            body = http.get().uri(uri -> uri.path(ORDER_DETAIL)
                            .queryParam("partner_id", config.partnerId())
                            .queryParam("timestamp", timestamp)
                            .queryParam("access_token", token)
                            .queryParam("shop_id", config.shopId())
                            .queryParam("sign", sign)
                            .queryParam("order_sn_list", orderSn)
                            .queryParam("response_optional_fields", "item_list")
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new MarketplaceException("Falha ao consultar o pedido " + orderSn + " na Shopee: " + e.getMessage(), e);
        }
        checkError(body, "consultar o pedido " + orderSn);
        JsonNode order = body.path("response").path("order_list").path(0);
        if (order.isMissingNode()) {
            throw new MarketplaceException("Shopee nao encontrou o pedido " + orderSn + ".");
        }
        return parseOrder(orderSn, order);
    }

    static ExternalOrder parseOrder(String orderSn, JsonNode order) {
        String status = order.path("order_status").asText("");
        State state = switch (status) {
            case "UNPAID" -> State.AWAITING_PAYMENT;
            // IN_CANCEL: comprador pediu cancelamento. Se for recusado, volta a READY_TO_SHIP e chega novo push.
            case "CANCELLED", "IN_CANCEL" -> State.CANCELLED;
            default -> State.PAID; // READY_TO_SHIP, PROCESSED, RETRY_SHIP, SHIPPED, TO_CONFIRM_RECEIVE, COMPLETED, TO_RETURN
        };
        List<Item> items = new ArrayList<>();
        for (JsonNode line : order.path("item_list")) {
            String sku = MarketplaceHttp.firstNonBlank(line.path("model_sku").asText(null), line.path("item_sku").asText(null));
            items.add(new Item(sku, line.path("item_name").asText(""), line.path("model_quantity_purchased").asInt()));
        }
        return new ExternalOrder(orderSn, state, status, items);
    }

    private Grant refresh(String refreshToken) {
        long timestamp = Instant.now().getEpochSecond();
        String sign = MarketplaceHttp.hmacSha256Hex(config.partnerKey(), config.partnerId() + REFRESH + timestamp);
        JsonNode body;
        try {
            body = http.post().uri(uri -> uri.path(REFRESH)
                            .queryParam("partner_id", config.partnerId())
                            .queryParam("timestamp", timestamp)
                            .queryParam("sign", sign)
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("refresh_token", refreshToken, "partner_id", config.partnerId(), "shop_id", config.shopId()))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new MarketplaceException("Falha ao renovar o token da Shopee: " + e.getMessage(), e);
        }
        checkError(body, "renovar o token");
        return new Grant(body.path("access_token").asText(), body.path("refresh_token").asText(null),
                body.path("expire_in").asLong(14400));
    }

    /** A Shopee devolve HTTP 200 com "error" preenchido em varias falhas. */
    private void checkError(JsonNode body, String action) {
        if (body == null) {
            throw new MarketplaceException("Shopee devolveu resposta vazia ao " + action + ".");
        }
        String error = body.path("error").asText("");
        if (!error.isBlank()) {
            if (error.contains("access_token") || error.contains("auth")) {
                tokens.invalidate(MARKETPLACE);
            }
            throw new MarketplaceException("Shopee recusou ao " + action + ": " + error + " - " + body.path("message").asText(""));
        }
    }
}
