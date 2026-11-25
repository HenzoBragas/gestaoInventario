package com.gestaoInvetario.application.integration;

import java.util.List;

/** Pedido normalizado, independente do marketplace de origem. */
public record ExternalOrder(String orderId, State state, String rawStatus, List<Item> items) {

    public enum State {
        /** Pago: o estoque deve ser baixado. */
        PAID,
        /** Ainda sem pagamento confirmado. */
        AWAITING_PAYMENT,
        /** Cancelado/invalido antes da baixa. */
        CANCELLED
    }

    /** @param sku SKU do vendedor no anuncio; deve ser igual ao codigo (SKU) do produto no sistema */
    public record Item(String sku, String title, int quantity) {
    }
}
