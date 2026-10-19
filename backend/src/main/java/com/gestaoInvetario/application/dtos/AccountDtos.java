package com.gestaoInvetario.application.dtos;

import com.gestaoInvetario.application.model.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Autenticacao, usuarios e configuracoes. */
public final class AccountDtos {

    private AccountDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "Informe seu e-mail ou usuário.") String username,
            @NotBlank(message = "Informe sua senha.") String password,
            boolean remember) {
    }

    public record UserResponse(Integer id, String username, String name, String email, Role role, boolean active,
                               boolean notifyLowStock, boolean notifyOutOfStock, boolean notifyMovements,
                               Instant createdAt, Instant lastLoginAt) {
    }

    public record LoginResponse(String token, Instant expiresAt, UserResponse user) {
    }

    public record PreferencesRequest(boolean notifyLowStock, boolean notifyOutOfStock, boolean notifyMovements) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Informe a senha atual.") String currentPassword,
            @NotBlank(message = "Informe a nova senha.")
            @Size(min = 8, max = 72, message = "A nova senha deve ter entre 8 e 72 caracteres.")
            String newPassword) {
    }

    public record UserRequest(
            @NotBlank(message = "Informe o login.")
            @Size(min = 3, max = 60, message = "O login deve ter entre 3 e 60 caracteres.")
            @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Use letras, números, ponto, hífen ou sublinhado.")
            String username,
            @NotBlank(message = "Informe o nome.")
            @Size(max = 120)
            String name,
            @Email(message = "Informe um e-mail válido.")
            @Size(max = 150)
            String email,
            @NotNull(message = "Selecione o perfil de acesso.")
            Role role,
            Boolean active,
            /** Obrigatoria na criacao; na edicao, so altera se informada. */
            @Size(min = 8, max = 72, message = "A senha deve ter entre 8 e 72 caracteres.")
            String password) {
    }

    public record SettingsRequest(
            @NotBlank(message = "Informe o nome da organização.")
            @Size(max = 120)
            String organizationName,
            @Size(max = 20)
            String taxId,
            @NotBlank @Pattern(regexp = "^(BRL|USD|EUR)$", message = "Moeda não suportada.")
            String currency,
            @NotBlank @Pattern(regexp = "^(pt-BR|en-US|es-ES)$", message = "Formato regional não suportado.")
            String locale,
            @NotBlank(message = "Informe o fuso horário.")
            String timeZone,
            @Min(value = 0, message = "O estoque mínimo padrão não pode ser negativo.")
            @Max(value = 100000)
            int defaultMinStock,
            @NotNull
            @Size(min = 1, max = 20, message = "Mantenha entre 1 e 20 unidades de medida.")
            List<@Pattern(regexp = "^[A-Z0-9]{1,10}$", message = "Unidades em maiúsculas, até 10 caracteres.") String> units) {
    }

    public record SettingsResponse(String organizationName, String taxId, String currency, String locale,
                                   String timeZone, int defaultMinStock, List<String> units, Instant updatedAt) {
    }
}
