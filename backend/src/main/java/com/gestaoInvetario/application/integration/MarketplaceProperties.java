package com.gestaoInvetario.application.integration;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Configuracao das integracoes (prefixo app.marketplace). Cada marketplace vem desligado por padrao. */
@ConfigurationProperties("app.marketplace")
public record MarketplaceProperties(
        @DefaultValue MercadoLivre mercadolivre,
        @DefaultValue Shopee shopee,
        @DefaultValue Worker worker) {

    /**
     * @param sellerId     id do vendedor (user_id); notificacoes de outros vendedores sao descartadas
     * @param refreshToken refresh token inicial obtido no fluxo OAuth; depois e renovado e guardado no banco
     */
    public record MercadoLivre(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("https://api.mercadolibre.com") String apiUrl,
            String clientId,
            String clientSecret,
            String refreshToken,
            Long sellerId) {
    }

    /**
     * @param pushUrl URL publica exata cadastrada no Shopee Open Platform para o push; entra na assinatura
     */
    public record Shopee(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("https://partner.shopeemobile.com") String apiUrl,
            Long partnerId,
            String partnerKey,
            Long shopId,
            String refreshToken,
            String pushUrl) {
    }

    /**
     * @param maxAttempts tentativas automaticas antes de exigir reprocessamento manual
     * @param staleAfter  tempo apos o qual um pedido preso em PROCESSING e retomado (worker caiu)
     */
    public record Worker(
            @DefaultValue("8") int maxAttempts,
            @DefaultValue("30s") Duration baseBackoff,
            @DefaultValue("1h") Duration maxBackoff,
            @DefaultValue("5m") Duration staleAfter) {
    }
}
