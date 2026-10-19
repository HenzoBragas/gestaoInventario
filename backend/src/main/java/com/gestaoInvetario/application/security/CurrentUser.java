package com.gestaoInvetario.application.security;

import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.Role;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

    public static final String SYSTEM = "sistema";

    private CurrentUser() {
    }

    public static Optional<AuthUser> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }

    public static AuthUser require() {
        return get().orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Sessão expirada. Entre novamente."));
    }

    public static String usernameOrSystem() {
        return get().map(AuthUser::username).orElse(SYSTEM);
    }

    /** Checagem de papel no servico (complementa as regras por rota do SecurityConfig). */
    public static void requireRole(Role minimum, String message) {
        if (!require().role().atLeast(minimum)) {
            throw ApiException.forbidden(message);
        }
    }
}
