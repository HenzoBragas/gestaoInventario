package com.gestaoInvetario.application.integration;

/** Falha ao falar com a API do marketplace ou ao interpretar a resposta. */
public class MarketplaceException extends RuntimeException {

    public MarketplaceException(String message) {
        super(message);
    }

    public MarketplaceException(String message, Throwable cause) {
        super(message, cause);
    }
}
