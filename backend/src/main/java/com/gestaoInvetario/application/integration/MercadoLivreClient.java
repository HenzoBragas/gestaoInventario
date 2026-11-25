package com.gestaoInvetario.application.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.gestaoInvetario.application.integration.ExternalOrder.Item;
import com.gestaoInvetario.application.integration.ExternalOrder.State;
import com.gestaoInvetario.application.integration.MarketplaceTokenService.Grant;
import com.gestaoInvetario.application.model.Marketplace;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Cliente da API do Mercado Livre. A notificacao (topic orders_v2) traz so o recurso
 * "/orders/{id}"; o pedido completo e sempre lido daqui, o que tambem impede que uma
 * notificacao forjada baixe estoque.
 */
@Component
public class MercadoLivreClient {

    private static final Marketplace MARKETPLACE = Marketplace.MERCADO_LIVRE;

    private final MarketplaceProperties.MercadoLivre config;
    private final MarketplaceTokenService tokens;
    private final RestClient http;

    public MercadoLivreClient(MarketplaceProperties properties, MarketplaceTokenService tokens, RestClient.Builder builder) {
        this.config = properties.mercadolivre();
        this.tokens = tokens;
        this.http = MarketplaceHttp.client(builder, config.apiUrl());
    }

    public ExternalOrder fetchOrder(String orderId) {
        String token = tokens.accessToken(MARKETPLACE, config.refreshToken(), this::refresh);
        JsonNode body;
        try {
            body = http.get().uri("/orders/{id}", orderId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
            tokens.invalidate(MARKETPLACE);
            throw new MarketplaceException("Mercado Livre recusou o token (" + e.getStatusCode().value()
                    + "); ele sera renovado na proxima tentativa.", e);
        } catch (RestClientException e) {
            throw new MarketplaceException("Falha ao consultar o pedido " + orderId + " no Mercado Livre: " + e.getMessage(), e);
        }
        if (body == null) {
            throw new MarketplaceException("Mercado Livre devolveu resposta vazia para o pedido " + orderId + ".");
        }
        if (config.sellerId() != null && body.path("seller").path("id").asLong() != config.sellerId()) {
            throw new MarketplaceException("O pedido " + orderId + " pertence a outro vendedor.");
        }
        return parseOrder(orderId, body);
    }

    static ExternalOrder parseOrder(String orderId, JsonNode body) {
        String status = body.path("status").asText("");
        State state = switch (status) {
            case "paid", "partially_refunded" -> State.PAID;
            case "cancelled", "invalid" -> State.CANCELLED;
            default -> State.AWAITING_PAYMENT; // confirmed, payment_required, payment_in_process, partially_paid
        };
        List<Item> items = new ArrayList<>();
        for (JsonNode line : body.path("order_items")) {
            JsonNode item = line.path("item");
            String sku = MarketplaceHttp.firstNonBlank(item.path("seller_sku").asText(null),
                    item.path("seller_custom_field").asText(null));
            items.add(new Item(sku, item.path("title").asText(""), line.path("quantity").asInt()));
        }
        return new ExternalOrder(orderId, state, status, items);
    }

    private Grant refresh(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("client_id", config.clientId());
        form.add("client_secret", config.clientSecret());
        form.add("refresh_token", refreshToken);
        try {
            JsonNode body = http.post().uri("/oauth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            if (body == null || body.path("access_token").asText("").isBlank()) {
                throw new MarketplaceException("Mercado Livre nao devolveu access_token ao renovar o token.");
            }
            return new Grant(body.path("access_token").asText(), body.path("refresh_token").asText(null),
                    body.path("expires_in").asLong(21600));
        } catch (RestClientException e) {
            throw new MarketplaceException("Falha ao renovar o token do Mercado Livre: " + e.getMessage(), e);
        }
    }
}
