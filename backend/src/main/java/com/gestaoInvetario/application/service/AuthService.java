package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.AccountDtos.ChangePasswordRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.LoginRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.LoginResponse;
import com.gestaoInvetario.application.dtos.AccountDtos.PreferencesRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.UserResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.repositories.AppUserRepository;
import com.gestaoInvetario.application.security.CurrentUser;
import com.gestaoInvetario.application.security.TokenService;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(1);

    private record Attempts(int failures, Instant lockedUntil) {
    }

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokens;
    private final AuditService audit;
    /** Contador em memoria por login (suficiente para uma instancia; use Redis se escalar horizontalmente). */
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    public AuthService(AppUserRepository users, PasswordEncoder passwordEncoder, TokenService tokens, AuditService audit) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.audit = audit;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String identifier = request.username().trim().toLowerCase();
        Attempts current = attempts.get(identifier);
        if (current != null && current.lockedUntil() != null && current.lockedUntil().isAfter(Instant.now())) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "Muitas tentativas. Aguarde um minuto e tente novamente.");
        }

        Optional<AppUser> found = identifier.contains("@")
                ? users.findByEmailIgnoreCase(identifier)
                : users.findByUsernameIgnoreCase(identifier);
        AppUser user = found
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElse(null);

        if (user == null) {
            registerFailure(identifier);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                    "Usuário ou senha incorretos. Confira os dados e tente novamente.");
        }
        if (!user.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_DISABLED",
                    "Este usuário está desativado. Fale com o administrador.");
        }
        attempts.remove(identifier);
        user.setLastLoginAt(Instant.now());
        users.save(user);
        TokenService.IssuedToken token = tokens.issue(user, request.remember());
        return new LoginResponse(token.token(), token.expiresAt(), toResponse(user));
    }

    @Transactional(readOnly = true)
    public UserResponse me() {
        return toResponse(current());
    }

    @Transactional
    public UserResponse updatePreferences(PreferencesRequest request) {
        AppUser user = current();
        user.setNotifyLowStock(request.notifyLowStock());
        user.setNotifyOutOfStock(request.notifyOutOfStock());
        user.setNotifyMovements(request.notifyMovements());
        return toResponse(users.save(user));
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        AppUser user = current();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ApiException.unprocessable("WRONG_PASSWORD", "A senha atual está incorreta.", "currentPassword");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        users.save(user);
        audit.record("USUARIO", user.getId(), "SENHA", "Usuário " + user.getUsername() + " alterou a própria senha.");
    }

    private AppUser current() {
        return users.findById(CurrentUser.require().id()).orElseThrow(() -> ApiException.notFound("Usuário"));
    }

    private void registerFailure(String identifier) {
        attempts.compute(identifier, (key, previous) -> {
            int failures = previous == null ? 1 : previous.failures() + 1;
            return failures >= MAX_ATTEMPTS
                    ? new Attempts(0, Instant.now().plus(LOCK_DURATION))
                    : new Attempts(failures, null);
        });
    }

    public static UserResponse toResponse(AppUser u) {
        return new UserResponse(u.getId(), u.getUsername(), u.getName(), u.getEmail(), u.getRole(), u.isActive(),
                u.isNotifyLowStock(), u.isNotifyOutOfStock(), u.isNotifyMovements(), u.getCreatedAt(), u.getLastLoginAt());
    }
}
