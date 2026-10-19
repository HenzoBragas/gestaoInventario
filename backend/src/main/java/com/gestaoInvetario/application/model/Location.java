package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "localizacao")
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "Codigo", nullable = false, unique = true, length = 20)
    private String code;

    @Column(name = "Nome", nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "Tipo", nullable = false, length = 20)
    private LocationType type = LocationType.WAREHOUSE;

    @Column(name = "Descricao", length = 255)
    private String description;

    @Column(name = "Ativo", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "Dta_criacao", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao")
    private Instant updatedAt;
}
