package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Tabela NotaFiscal do script do banco ("Tabelas BD.sql"), auditada pelo trigger trg_audita_notafiscal_*.
 * Arquivo_nome/tipo/tamanho foram acrescentados para permitir baixar o anexo com o nome original.
 * O anexo (Arquivo_nfe) nunca e carregado nas listagens: elas usam projecoes (InvoiceService).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "nota_fiscal", indexes = {
        @Index(name = "idx_nota_fiscal_produto", columnList = "Produto"),
        @Index(name = "idx_nota_fiscal_pagamento", columnList = "Dta_pagamento")
})
public class Invoice {

    /** Limite do anexo (PDF, XML ou imagem da NF-e). */
    public static final int MAX_FILE_BYTES = 5 * 1024 * 1024;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ")
    private Integer id;

    @Column(name = "Numero_nota", nullable = false, length = 50)
    private String number;

    @Column(name = "Local_compra", nullable = false, length = 100)
    private String purchasePlace;

    @Column(name = "Valor", nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "Dta_pagamento", nullable = false)
    private LocalDate paymentDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "Produto", nullable = false)
    private Product product;

    /** Funcionario responsavel pela compra. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "Funcionario", nullable = false)
    private AppUser employee;

    /** LONGBLOB no MySQL; bytea no PostgreSQL. */
    @Column(name = "Arquivo_nfe", columnDefinition = "bytea")
    private byte[] file;

    @Column(name = "Arquivo_nome", length = 255)
    private String fileName;

    @Column(name = "Arquivo_tipo", length = 100)
    private String fileType;

    @Column(name = "Arquivo_tamanho")
    private Integer fileSize;

    @CreationTimestamp
    @Column(name = "Dta_criacao", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao")
    private Instant updatedAt;
}
