package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "categoria")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ")
    private Integer seq;

    @Column(name = "Nome", nullable = false, length = 50)
    private String name;

    @Column(name = "Inativo")
    private Integer inactive;

    @Column(name = "Descricao", length = 255)
    private String description;

    public Category(Integer seq, String name, Integer inactive) {
        this(seq, name, inactive, null);
    }

    public boolean isActive() {
        return inactive == null || inactive == 0;
    }
}
