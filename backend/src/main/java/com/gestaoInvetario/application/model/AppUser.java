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

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "usuario")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "Login", nullable = false, unique = true, length = 60)
    private String username;

    @Column(name = "Nome", nullable = false, length = 120)
    private String name;

    @Column(name = "Email", unique = true, length = 150)
    private String email;

    @Column(name = "Senha_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "Papel", nullable = false, length = 20)
    private Role role = Role.VIEWER;

    @Column(name = "Ativo", nullable = false)
    private boolean active = true;

    // Preferencias da central de notificacoes
    @Column(name = "Notif_estoque_baixo", nullable = false)
    private boolean notifyLowStock = true;

    @Column(name = "Notif_sem_estoque", nullable = false)
    private boolean notifyOutOfStock = true;

    @Column(name = "Notif_movimentacoes", nullable = false)
    private boolean notifyMovements = true;

    @CreationTimestamp
    @Column(name = "Dta_criacao", updatable = false)
    private Instant createdAt;

    @Column(name = "Ultimo_acesso")
    private Instant lastLoginAt;
}
