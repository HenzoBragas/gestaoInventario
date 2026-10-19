package com.gestaoInvetario.application.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

/** Configuracoes da organizacao (linha unica, id = 1). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "configuracao")
public class AppSettings {

    public static final int SINGLETON_ID = 1;

    @Id
    private Integer id = SINGLETON_ID;

    @Column(name = "Nome_organizacao", nullable = false, length = 120)
    private String organizationName = "Gestão de Inventário";

    @Column(name = "Documento", length = 20)
    private String taxId;

    @Column(name = "Moeda", nullable = false, length = 3)
    private String currency = "BRL";

    @Column(name = "Localidade", nullable = false, length = 10)
    private String locale = "pt-BR";

    @Column(name = "Fuso_horario", nullable = false, length = 40)
    private String timeZone = "America/Sao_Paulo";

    /** Estoque minimo sugerido para novos produtos. */
    @Column(name = "Estoque_minimo_padrao", nullable = false)
    private int defaultMinStock = 5;

    /** Unidades de medida aceitas, separadas por virgula. */
    @Column(name = "Unidades", nullable = false, length = 255)
    private String units = "UN,CX,PC,KG,G,L,ML,M,PAR,KIT";

    /** Marca que a carga de dados de demonstracao ja foi executada. */
    @Column(name = "Carga_demo_executada", nullable = false)
    private boolean demoDataLoaded = false;

    @UpdateTimestamp
    @Column(name = "Dta_atualizacao")
    private Instant updatedAt;
}
