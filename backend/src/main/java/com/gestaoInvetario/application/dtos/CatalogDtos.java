package com.gestaoInvetario.application.dtos;

import com.gestaoInvetario.application.model.LocationType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

/** Categorias, fornecedores e localizacoes. */
public final class CatalogDtos {

    private CatalogDtos() {
    }

    // ---------- Categorias ----------

    public record CategoryRequest(
            @NotBlank(message = "Informe o nome da categoria.")
            @Size(max = 50, message = "O nome deve ter no máximo 50 caracteres.")
            String name,
            @Size(max = 255, message = "A descrição deve ter no máximo 255 caracteres.")
            String description,
            Integer inactive) {
    }

    public record ReassignRequest(@NotNull(message = "Selecione a categoria de destino.") Integer targetCategoryId) {
    }

    /** Mantem `seq` e `inactive` do contrato original. */
    public record CategoryResponse(Integer seq, String name, String description, Integer inactive, boolean active,
                                   long productCount) {
    }

    // ---------- Fornecedores ----------

    public record SupplierRequest(
            @NotBlank(message = "Informe o nome ou razão social.")
            @Size(max = 150, message = "O nome deve ter no máximo 150 caracteres.")
            String name,
            @Size(max = 20, message = "O documento deve ter no máximo 20 caracteres.")
            @Pattern(regexp = "^[0-9./\\-]*$", message = "Use apenas números, ponto, barra ou hífen.")
            String taxId,
            @Email(message = "Informe um e-mail válido.")
            @Size(max = 150)
            String email,
            @Size(max = 30, message = "O telefone deve ter no máximo 30 caracteres.")
            @Pattern(regexp = "^[0-9()+\\- ]*$", message = "Use apenas números, espaços, parênteses, + ou hífen.")
            String phone,
            @Size(max = 255, message = "O endereço deve ter no máximo 255 caracteres.")
            String address,
            @Size(max = 1000, message = "As observações devem ter no máximo 1000 caracteres.")
            String notes,
            Boolean active) {
    }

    public record SupplierResponse(Integer id, String name, String taxId, String email, String phone, String address,
                                   String notes, boolean active, long productCount, Instant createdAt,
                                   Instant updatedAt) {
    }

    // ---------- Localizacoes ----------

    public record LocationRequest(
            @NotBlank(message = "Informe o código.")
            @Size(max = 20, message = "O código deve ter no máximo 20 caracteres.")
            @Pattern(regexp = "^[A-Za-z0-9\\-_.]+$", message = "Use apenas letras, números, hífen, ponto ou sublinhado.")
            String code,
            @NotBlank(message = "Informe o nome.")
            @Size(max = 100, message = "O nome deve ter no máximo 100 caracteres.")
            String name,
            @NotNull(message = "Selecione o tipo.")
            LocationType type,
            @Size(max = 255, message = "A descrição deve ter no máximo 255 caracteres.")
            String description,
            Boolean active) {
    }

    public record LocationResponse(Integer id, String code, String name, LocationType type, String description,
                                   boolean active, long productCount, long totalUnits, BigDecimal totalValue,
                                   Instant createdAt, Instant updatedAt) {
    }

    public record LocationBalance(Integer productId, String sku, String productName, String categoryName,
                                  String unit, int quantity, BigDecimal unitCost, BigDecimal value) {
    }
}
