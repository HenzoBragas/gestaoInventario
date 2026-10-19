package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.AccountDtos.ChangePasswordRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.LoginRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.LoginResponse;
import com.gestaoInvetario.application.dtos.AccountDtos.PreferencesRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.SettingsRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.SettingsResponse;
import com.gestaoInvetario.application.dtos.AccountDtos.UserRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.UserResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.service.AuditService;
import com.gestaoInvetario.application.service.AuditService.AuditEntry;
import com.gestaoInvetario.application.service.AuthService;
import com.gestaoInvetario.application.service.SettingsService;
import com.gestaoInvetario.application.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Autenticacao, conta do usuario, gestao de usuarios, configuracoes e auditoria. */
@RestController
public class AccountController {

    private final AuthService auth;
    private final UserService users;
    private final SettingsService settings;
    private final AuditService audit;

    public AccountController(AuthService auth, UserService users, SettingsService settings, AuditService audit) {
        this.auth = auth;
        this.users = users;
        this.settings = settings;
        this.audit = audit;
    }

    @PostMapping("/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @GetMapping("/auth/me")
    public UserResponse me() {
        return auth.me();
    }

    @PutMapping("/auth/me/preferences")
    public UserResponse preferences(@RequestBody PreferencesRequest request) {
        return auth.updatePreferences(request);
    }

    @PutMapping("/auth/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        auth.changePassword(request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    public List<UserResponse> listUsers() {
        return users.getAll();
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(users.create(request));
    }

    @PutMapping("/users/{id}")
    public UserResponse updateUser(@PathVariable Integer id, @Valid @RequestBody UserRequest request) {
        return users.update(id, request);
    }

    @GetMapping("/settings")
    public SettingsResponse getSettings() {
        return settings.get();
    }

    @PutMapping("/settings")
    public SettingsResponse updateSettings(@Valid @RequestBody SettingsRequest request) {
        return settings.update(request);
    }

    @GetMapping("/audit")
    public PageResponse<AuditEntry> audit(@RequestParam(required = false) String entity,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "25") int size) {
        return audit.search(entity, q, page, size);
    }
}
