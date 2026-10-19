package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

/** Saldo de um produto em uma localizacao. A soma dos saldos e o Product.stock. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "saldo_estoque", uniqueConstraints = @UniqueConstraint(columnNames = {"Produto", "Localizacao"}))
public class StockBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "Produto", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "Localizacao", nullable = false)
    private Location location;

    @Column(name = "Quantidade", nullable = false)
    private int quantity;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao")
    private Instant updatedAt;

    public StockBalance(Product product, Location location) {
        this.product = product;
        this.location = location;
        this.quantity = 0;
    }
}
