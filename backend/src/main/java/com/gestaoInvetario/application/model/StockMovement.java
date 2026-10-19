package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Registro de uma alteracao de estoque. Nao ha endpoint de edicao nem exclusao:
 * correcoes sao feitas com uma nova movimentacao (ex.: ajuste), preservando o historico.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "movimentacao_estoque", indexes = {
        @Index(name = "idx_mov_data", columnList = "Dta_movimentacao"),
        @Index(name = "idx_mov_produto", columnList = "Produto")
})
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "Tipo", nullable = false, length = 20)
    private MovementType type;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "Produto", nullable = false)
    private Product product;

    /** Quantidade movimentada, sempre positiva. */
    @Column(name = "Quantidade", nullable = false)
    private int quantity;

    /** Efeito no saldo total do produto (+entrada, -saida, 0 transferencia). */
    @Column(name = "Variacao", nullable = false)
    private int delta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "Origem")
    private Location fromLocation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "Destino")
    private Location toLocation;

    @Column(name = "Motivo", length = 60)
    private String reason;

    @Column(name = "Observacoes", length = 1000)
    private String notes;

    @Column(name = "Referencia", length = 60)
    private String reference;

    @Column(name = "Usuario", nullable = false, length = 60)
    private String username;

    @Column(name = "Usuario_nome", length = 120)
    private String userDisplayName;

    @Column(name = "Dta_movimentacao", nullable = false)
    private Instant createdAt;

    @Column(name = "Saldo_total_anterior", nullable = false)
    private int totalBefore;

    @Column(name = "Saldo_total_posterior", nullable = false)
    private int totalAfter;

    @Column(name = "Saldo_origem_anterior")
    private Integer fromBefore;

    @Column(name = "Saldo_origem_posterior")
    private Integer fromAfter;

    @Column(name = "Saldo_destino_anterior")
    private Integer toBefore;

    @Column(name = "Saldo_destino_posterior")
    private Integer toAfter;

    /** Chave de idempotencia enviada pelo cliente: evita registrar o mesmo envio duas vezes. */
    @Column(name = "Chave_requisicao", unique = true, length = 64)
    private String requestKey;
}
