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
import java.math.BigDecimal;
import java.util.Date;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "produto")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "Id")
    private Integer id;

    /** SKU / codigo interno do produto (coluna historica "SEQ"). */
    @Column(name = "SEQ", nullable = false, length = 20)
    private String code;

    @Column(name = "Nome", nullable = false, length = 150)
    private String name;

    @Column(name = "Modelo", nullable = false, length = 60)
    private String model;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "Categoria", nullable = false)
    private Category category;

    /**
     * Saldo total (soma dos saldos por localizacao). Mantido exclusivamente pelo
     * StockService ao registrar movimentacoes; nunca e alterado pela edicao do cadastro.
     */
    @Column(name = "Qtd", nullable = false)
    private Integer stock;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao", nullable = false)
    private Date updatedAt;

    // ---- Campos adicionados na evolucao do cadastro (com default para as linhas antigas) ----

    @Column(name = "Codigo_barras", length = 50)
    private String barcode;

    @Column(name = "Descricao", length = 1000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "Fornecedor")
    private Supplier supplier;

    @Column(name = "Unidade", columnDefinition = "varchar(10) default 'UN'")
    private String unit = "UN";

    @Column(name = "Custo_unitario", columnDefinition = "numeric(12,2) default 0")
    private BigDecimal unitCost = BigDecimal.ZERO;

    @Column(name = "Preco_venda", precision = 12, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "Estoque_minimo", columnDefinition = "integer default 5")
    private Integer minStock = 5;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "Localizacao_padrao")
    private Location defaultLocation;

    @Column(name = "Imagem_url", length = 500)
    private String imageUrl;

    @Column(name = "Ativo", columnDefinition = "boolean default true")
    private Boolean active = true;

    @Column(name = "Dta_criacao")
    private Date createdAt;

    public boolean isActive() {
        return active == null || active;
    }

    public int stockOrZero() {
        return stock == null ? 0 : stock;
    }

    public int minStockOrDefault() {
        return minStock == null ? 5 : minStock;
    }

    public BigDecimal unitCostOrZero() {
        return unitCost == null ? BigDecimal.ZERO : unitCost;
    }

    public StockStatus status() {
        return StockStatus.of(isActive(), stockOrZero(), minStockOrDefault());
    }
}
