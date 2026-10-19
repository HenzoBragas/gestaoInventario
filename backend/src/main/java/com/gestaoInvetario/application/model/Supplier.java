package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fornecedor")
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "Nome", nullable = false, length = 150)
    private String name;

    /** CNPJ/CPF ou outro identificador fiscal (opcional). */
    @Column(name = "Documento", length = 20)
    private String taxId;

    @Column(name = "Email", length = 150)
    private String email;

    @Column(name = "Telefone", length = 30)
    private String phone;

    @Column(name = "Endereco", length = 255)
    private String address;

    @Column(name = "Observacoes", length = 1000)
    private String notes;

    @Column(name = "Ativo", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "Dta_criacao", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao")
    private Instant updatedAt;
}
