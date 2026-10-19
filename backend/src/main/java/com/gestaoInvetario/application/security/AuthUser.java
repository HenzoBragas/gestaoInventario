package com.gestaoInvetario.application.security;

import com.gestaoInvetario.application.model.Role;

/** Usuario autenticado da requisicao atual (principal do Spring Security). */
public record AuthUser(Integer id, String username, String name, Role role) {
}
