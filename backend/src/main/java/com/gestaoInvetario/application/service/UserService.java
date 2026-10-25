package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.AccountDtos.EmployeeOption;
import com.gestaoInvetario.application.dtos.AccountDtos.UserRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.UserResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.model.Role;
import com.gestaoInvetario.application.repositories.AppUserRepository;
import com.gestaoInvetario.application.security.CurrentUser;
import java.util.Comparator;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestao de usuarios (rotas restritas a ADMIN no SecurityConfig). */
@Service
public class UserService {

    private final AppUserRepository repository;
    private final PasswordEncoder passwordEncoder;

    public UserService(AppUserRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<EmployeeOption> options() {
        return repository.findAll().stream()
                .filter(AppUser::isActive)
                .sorted(Comparator.comparing(AppUser::getName, String.CASE_INSENSITIVE_ORDER))
                .map(u -> new EmployeeOption(u.getId(), u.getName(), u.getUsername()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAll() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(AppUser::getName, String.CASE_INSENSITIVE_ORDER))
                .map(AuthService::toResponse)
                .toList();
    }

    @Transactional
    public UserResponse create(UserRequest request) {
        if (request.password() == null || request.password().isBlank()) {
            throw ApiException.unprocessable("PASSWORD_REQUIRED", "Defina uma senha inicial.", "password");
        }
        String username = request.username().trim().toLowerCase();
        ensureUnique(username, normalizeEmail(request.email()), null);
        AppUser user = new AppUser();
        user.setUsername(username);
        apply(user, request);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        AppUser saved = repository.save(user);
        return AuthService.toResponse(saved);
    }

    @Transactional
    public UserResponse update(Integer id, UserRequest request) {
        AppUser user = repository.findById(id).orElseThrow(() -> ApiException.notFound("Usuário"));
        String username = request.username().trim().toLowerCase();
        ensureUnique(username, normalizeEmail(request.email()), id);

        boolean self = CurrentUser.require().id().equals(id);
        boolean deactivating = Boolean.FALSE.equals(request.active());
        if (self && (deactivating || request.role() != user.getRole())) {
            throw ApiException.unprocessable("SELF_CHANGE",
                    "Você não pode alterar o próprio perfil nem desativar a própria conta.", "role");
        }
        boolean losesAdmin = user.getRole() == Role.ADMIN && user.isActive()
                && (request.role() != Role.ADMIN || deactivating);
        if (losesAdmin && repository.countByRoleAndActiveTrue(Role.ADMIN) <= 1) {
            throw ApiException.unprocessable("LAST_ADMIN", "O sistema precisa de ao menos um administrador ativo.", "role");
        }

        user.setUsername(username);
        apply(user, request);
        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        repository.save(user);
        return AuthService.toResponse(user);
    }

    private void apply(AppUser user, UserRequest request) {
        user.setName(request.name().trim());
        user.setEmail(normalizeEmail(request.email()));
        user.setRole(request.role());
        if (request.active() != null) {
            user.setActive(request.active());
        }
    }

    private void ensureUnique(String username, String email, Integer currentId) {
        repository.findByUsernameIgnoreCase(username).ifPresent(existing -> {
            if (currentId == null || !existing.getId().equals(currentId)) {
                throw ApiException.conflict("USERNAME_TAKEN", "Este login já está em uso.", "username");
            }
        });
        if (email != null) {
            repository.findByEmailIgnoreCase(email).ifPresent(existing -> {
                if (currentId == null || !existing.getId().equals(currentId)) {
                    throw ApiException.conflict("EMAIL_TAKEN", "Este e-mail já está em uso.", "email");
                }
            });
        }
    }

    private static String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim().toLowerCase();
    }
}
