package com.gestaoInvetario.application.controllers;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.integration.ExternalOrder;
import com.gestaoInvetario.application.integration.ExternalOrder.State;
import com.gestaoInvetario.application.integration.MarketplaceOrderService;
import com.gestaoInvetario.application.integration.SimulatedOrderStore;
import com.gestaoInvetario.application.model.Marketplace;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Simula uma venda de marketplace (somente com app.marketplace.simulation.enabled=true; em producao
 * responde 404). O pedido passa pela mesma fila, worker assincrono e baixa de estoque das vendas reais;
 * so a leitura do pedido na API do marketplace e substituida pelos dados enviados aqui.
 * Para simular a mudanca de status (ex.: payment_required -> paid), envie de novo o mesmo orderId.
 */
@RestController
@RequestMapping("/integrations/simulate")
public class MarketplaceSimulationController {

    public record SimulatedItem(@NotBlank String sku, String title, @NotNull @Min(1) Integer quantity) {
    }

    public record SimulatedOrderRequest(
            @NotBlank String orderId,
            /** PAID (padrao), AWAITING_PAYMENT ou CANCELLED. */
            State state,
            @NotEmpty List<@Valid SimulatedItem> items,
            /** false: so registra o pedido, sem enfileirar; o processamento vem pelo webhook real. Padrao true. */
            @JsonProperty("notify") Boolean shouldNotify) {
    }

    private final SimulatedOrderStore store;
    private final MarketplaceOrderService orders;

    public MarketplaceSimulationController(SimulatedOrderStore store, MarketplaceOrderService orders) {
        this.store = store;
        this.orders = orders;
    }

    /** marketplace: mercadolivre ou shopee. */
    @PostMapping("/{marketplace}")
    public ResponseEntity<Map<String, Object>> simulate(@PathVariable String marketplace,
                                                        @Valid @RequestBody SimulatedOrderRequest request) {
        if (!store.isEnabled()) {
            return ResponseEntity.notFound().build();
        }
        Marketplace target = switch (marketplace.toLowerCase()) {
            case "mercadolivre", "mercado_livre", "ml" -> Marketplace.MERCADO_LIVRE;
            case "shopee" -> Marketplace.SHOPEE;
            default -> throw ApiException.notFound("Marketplace");
        };
        State state = request.state() == null ? State.PAID : request.state();
        List<ExternalOrder.Item> items = request.items().stream()
                .map(i -> new ExternalOrder.Item(i.sku().trim(), i.title() == null ? i.sku() : i.title(), i.quantity()))
                .toList();
        store.put(target, new ExternalOrder(request.orderId().trim(), state, "SIMULADO_" + state.name(), items));
        boolean notify = request.shouldNotify() == null || request.shouldNotify();
        if (notify) {
            orders.enqueue(target, request.orderId());
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("marketplace", target, "orderId", request.orderId().trim(), "state", state,
                        "message", notify ? "Pedido enfileirado; acompanhe em GET /integrations/orders."
                                : "Pedido registrado; dispare o processamento pelo webhook."));
    }
}
