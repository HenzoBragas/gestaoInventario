package com.gestaoInvetario.application.dtos;

import com.gestaoInvetario.application.model.StockStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class ProductDtos {

    private ProductDtos() {
    }

    /**
     * Cadastro/edicao. O saldo NUNCA e alterado por aqui: initialQuantity so e usado na criacao
     * e gera uma movimentacao de entrada ("Saldo inicial").
     */
    public record ProductRequest(
            @NotBlank(message = "Informe o SKU.")
            @Size(max = 20, message = "O SKU deve ter no máximo 20 caracteres.")
            @Pattern(regexp = "^[A-Za-z0-9._\\-/]+$", message = "Use apenas letras, números, ponto, hífen, barra ou sublinhado.")
            String sku,
            @NotBlank(message = "Informe o nome do produto.")
            @Size(max = 150, message = "O nome deve ter no máximo 150 caracteres.")
            String name,
            @Size(max = 60, message = "O modelo deve ter no máximo 60 caracteres.")
            String model,
            @Size(max = 50, message = "O código de barras deve ter no máximo 50 caracteres.")
            @Pattern(regexp = "^[0-9]*$", message = "O código de barras deve conter apenas números.")
            String barcode,
            @Size(max = 1000, message = "A descrição deve ter no máximo 1000 caracteres.")
            String description,
            @NotNull(message = "Selecione a categoria.")
            Integer categoryId,
            Integer supplierId,
            @NotBlank(message = "Selecione a unidade de medida.")
            @Size(max = 10)
            String unit,
            @NotNull(message = "Informe o custo unitário.")
            @DecimalMin(value = "0.00", message = "O custo não pode ser negativo.")
            @Digits(integer = 10, fraction = 2, message = "Use no máximo 2 casas decimais.")
            BigDecimal unitCost,
            @DecimalMin(value = "0.00", message = "O preço não pode ser negativo.")
            @Digits(integer = 10, fraction = 2, message = "Use no máximo 2 casas decimais.")
            BigDecimal salePrice,
            @NotNull(message = "Informe o estoque mínimo.")
            @Min(value = 0, message = "O estoque mínimo não pode ser negativo.")
            Integer minStock,
            Integer defaultLocationId,
            @Size(max = 500, message = "A URL da imagem deve ter no máximo 500 caracteres.")
            @Pattern(regexp = "^(https?://.+)?$", message = "Informe uma URL iniciando com http:// ou https://.")
            String imageUrl,
            Boolean active,
            @Min(value = 0, message = "A quantidade inicial não pode ser negativa.")
            Integer initialQuantity) {
    }

    public record StatusRequest(@NotNull Boolean active) {
    }

    public record LocationQuantity(Integer locationId, String code, String name, int quantity) {
    }

    public record ProductResponse(
            Integer id,
            String sku,
            String name,
            String model,
            String barcode,
            String description,
            Integer categoryId,
            String categoryName,
            Integer supplierId,
            String supplierName,
            String unit,
            BigDecimal unitCost,
            BigDecimal salePrice,
            int minStock,
            Integer defaultLocationId,
            String defaultLocationName,
            String imageUrl,
            boolean active,
            int stock,
            StockStatus status,
            BigDecimal stockValue,
            Instant createdAt,
            Instant updatedAt,
            List<LocationQuantity> locations) {
    }
}
