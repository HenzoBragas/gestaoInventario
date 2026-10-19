package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Trilha de auditoria das alteracoes de cadastro, usuarios e configuracoes. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "auditoria", indexes = @Index(name = "idx_auditoria_data", columnList = "Dta_evento"))
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "Entidade", nullable = false, length = 40)
    private String entity;

    @Column(name = "Entidade_id", length = 40)
    private String entityId;

    @Column(name = "Acao", nullable = false, length = 20)
    private String action;

    @Column(name = "Resumo", nullable = false, length = 500)
    private String summary;

    @Column(name = "Usuario", nullable = false, length = 60)
    private String username;

    @Column(name = "Dta_evento", nullable = false)
    private Instant createdAt = Instant.now();
}
