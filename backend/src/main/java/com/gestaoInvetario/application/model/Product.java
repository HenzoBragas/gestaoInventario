package com.gestaoInvetario.application.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "produto")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "Id")
    private Integer id;

    @Column(name = "SEQ", nullable = false, length = 20)
    private String code;

    @Column(name = "Nome", nullable = false, length = 30)
    private String name;

    @Column(name = "Modelo", nullable = false, length = 30)
    private String model;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "Categoria", nullable = false)
    private Category category;

    @Column(name = "Qtd", nullable = false)
    private Integer stock;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao", nullable = false)
    private Date updatedAt;
}
