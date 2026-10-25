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
import org.hibernate.annotations.Immutable;

/**
 * Tabela Auditoria do script do banco ("Tabelas BD.sql"): uma linha por campo alterado.
 * Gravada exclusivamente pelos triggers (db/auditoria-triggers.sql); a aplicacao so le.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Immutable
@Table(name = "auditoria", indexes = {
        @Index(name = "idx_auditoria_dta", columnList = "Dta_alteracao"),
        @Index(name = "idx_auditoria_tabela", columnList = "Tabela_alterada")
})
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ")
    private Integer id;

    @Column(name = "Tabela_alterada", nullable = false, length = 30)
    private String table;

    @Column(name = "Campo_alterado", nullable = false, length = 20)
    private String field;

    @Column(name = "Valor_anterior", nullable = false, length = 100)
    private String oldValue;

    @Column(name = "Valor_atual", nullable = false, length = 100)
    private String newValue;

    @Column(name = "Dta_alteracao", nullable = false)
    private Instant changedAt;

    /** Id do usuario (Funcionario) da aplicacao; nulo quando a alteracao veio de fora dela. */
    @Column(name = "Funcionario")
    private Integer employeeId;

    /** Usuario do SGBD que executou o comando. */
    @Column(name = "Usuario_Banco", nullable = false, length = 50)
    private String dbUser;
}
