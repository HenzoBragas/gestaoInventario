package com.gestaoInvetario.application.model;

/** Papeis em ordem crescente de permissao. */
public enum Role {
    VIEWER,
    OPERATOR,
    MANAGER,
    ADMIN;

    public boolean atLeast(Role other) {
        return this.ordinal() >= other.ordinal();
    }
}
