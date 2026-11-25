package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Fila (inbox) de pedidos recebidos dos marketplaces. Uma linha por pedido externo: o webhook
 * apenas grava/reabre a linha e o worker assincrono busca o pedido na API e baixa o estoque.
 * O @Version evita que webhook e worker sobrescrevam as alteracoes um do outro.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "pedido_marketplace",
        uniqueConstraints = @UniqueConstraint(columnNames = {"Marketplace", "Pedido_externo"}),
        indexes = @Index(name = "idx_pedmkt_status", columnList = "Status, Proxima_tentativa"))
public class MarketplaceOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "Marketplace", nullable = false, length = 20)
    private Marketplace marketplace;

    @Column(name = "Pedido_externo", nullable = false, length = 40)
    private String externalOrderId;

    @Column(name = "Status_externo", length = 40)
    private String externalStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "Status", nullable = false, length = 20)
    private MarketplaceOrderStatus status = MarketplaceOrderStatus.PENDING;

    @Column(name = "Tentativas", nullable = false)
    private int attempts;

    /** Chegou notificacao enquanto o pedido era processado: reprocessar ao terminar. */
    @Column(name = "Reprocessar", nullable = false)
    private boolean requeue;

    @Column(name = "Ultimo_erro", length = 1000)
    private String lastError;

    /** Itens baixados, ex.: "2x CAB-001; 1x MOU-010". */
    @Column(name = "Resumo", length = 500)
    private String summary;

    @Column(name = "Proxima_tentativa")
    private Instant nextAttemptAt;

    @Column(name = "Dta_bloqueio")
    private Instant lockedAt;

    @Column(name = "Dta_recebimento", nullable = false)
    private Instant receivedAt;

    @Column(name = "Dta_ultima_notificacao")
    private Instant lastNotificationAt;

    @Column(name = "Dta_processamento")
    private Instant processedAt;

    @Version
    @Column(name = "Versao", nullable = false)
    private long version;
}
