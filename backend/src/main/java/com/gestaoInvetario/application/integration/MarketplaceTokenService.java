package com.gestaoInvetario.application.integration;

import com.gestaoInvetario.application.model.Marketplace;
import com.gestaoInvetario.application.model.MarketplaceToken;
import com.gestaoInvetario.application.repositories.MarketplaceTokenRepository;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Entrega um access token valido, renovando-o quando falta pouco para expirar. A linha do token
 * fica bloqueada durante a renovacao porque o refresh token e de uso unico nos dois marketplaces.
 */
@Service
public class MarketplaceTokenService {

    /** Renova antes do vencimento para nao usar um token que expira no meio da chamada. */
    private static final Duration EARLY_REFRESH = Duration.ofMinutes(5);

    @FunctionalInterface
    public interface Refresher {
        Grant refresh(String refreshToken);
    }

    public record Grant(String accessToken, String refreshToken, long expiresInSeconds) {
    }

    private final MarketplaceTokenRepository tokens;
    private final TransactionTemplate tx;

    public MarketplaceTokenService(MarketplaceTokenRepository tokens, PlatformTransactionManager txManager) {
        this.tokens = tokens;
        this.tx = new TransactionTemplate(txManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * @param seedRefreshToken refresh token da configuracao, usado so enquanto nao ha token salvo no banco
     */
    public String accessToken(Marketplace marketplace, String seedRefreshToken, Refresher refresher) {
        return tx.execute(status -> {
            MarketplaceToken token = tokens.findForUpdate(marketplace).orElseGet(() -> {
                if (seedRefreshToken == null || seedRefreshToken.isBlank()) {
                    throw new MarketplaceException(marketplace.label()
                            + ": nenhum token salvo e nenhum refresh token configurado.");
                }
                return new MarketplaceToken(marketplace, seedRefreshToken.trim());
            });
            if (token.getAccessToken() == null || token.getExpiresAt() == null
                    || token.getExpiresAt().isBefore(Instant.now().plus(EARLY_REFRESH))) {
                Grant grant = refresher.refresh(token.getRefreshToken());
                token.setAccessToken(grant.accessToken());
                if (grant.refreshToken() != null && !grant.refreshToken().isBlank()) {
                    token.setRefreshToken(grant.refreshToken());
                }
                token.setExpiresAt(Instant.now().plusSeconds(grant.expiresInSeconds()));
                tokens.save(token);
            }
            return token.getAccessToken();
        });
    }

    /** Forca a renovacao na proxima chamada (ex.: a API respondeu 401). */
    public void invalidate(Marketplace marketplace) {
        tx.executeWithoutResult(status -> tokens.findForUpdate(marketplace).ifPresent(token -> {
            token.setExpiresAt(null);
            tokens.save(token);
        }));
    }
}
