package com.gestaoInvetario.application.model;

public enum Marketplace {
    MERCADO_LIVRE("ML", "Mercado Livre"),
    SHOPEE("SHP", "Shopee");

    /** Prefixo curto usado na chave de idempotencia das movimentacoes. */
    private final String code;
    private final String label;

    Marketplace(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String code() {
        return code;
    }

    public String label() {
        return label;
    }
}
