package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Tokens OAuth de cada marketplace. Mercado Livre e Shopee trocam o refresh token a cada
 * renovacao (uso unico), entao o par atual precisa ficar persistido, nao so na variavel de ambiente.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "token_marketplace")
public class MarketplaceToken {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "Marketplace", length = 20)
    private Marketplace marketplace;

    @Column(name = "Access_token", length = 2000)
    private String accessToken;

    @Column(name = "Refresh_token", nullable = false, length = 2000)
    private String refreshToken;

    @Column(name = "Expira_em")
    private Instant expiresAt;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao")
    private Instant updatedAt;

    public MarketplaceToken(Marketplace marketplace, String refreshToken) {
        this.marketplace = marketplace;
        this.refreshToken = refreshToken;
    }
}
