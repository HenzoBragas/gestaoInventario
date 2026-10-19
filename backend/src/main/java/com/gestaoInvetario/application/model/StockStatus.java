package com.gestaoInvetario.application.model;

/**
 * Regra unica de status do estoque, usada por API, filtros e relatorios.
 * INACTIVE tem precedencia: um produto desativado nao e "sem estoque".
 * LOW_STOCK: saldo maior que zero e menor ou igual ao estoque minimo do produto.
 */
public enum StockStatus {
    IN_STOCK,
    LOW_STOCK,
    OUT_OF_STOCK,
    INACTIVE;

    public static StockStatus of(boolean active, int stock, int minStock) {
        if (!active) return INACTIVE;
        if (stock <= 0) return OUT_OF_STOCK;
        if (stock <= minStock) return LOW_STOCK;
        return IN_STOCK;
    }
}
