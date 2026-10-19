package com.gestaoInvetario.application.dtos;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Notas fiscais de compra. */
public final class InvoiceDtos {

    private InvoiceDtos() {
    }

    public record InvoiceRequest(
            @NotBlank(message = "Informe o número da nota.")
            @Size(max = 50, message = "O número deve ter no máximo 50 caracteres.")
            String number,
            @NotBlank(message = "Informe o local de compra.")
            @Size(max = 100, message = "O local de compra deve ter no máximo 100 caracteres.")
            String purchasePlace,
            @NotNull(message = "Informe o valor.")
            @DecimalMin(value = "0.01", message = "O valor deve ser maior que zero.")
            @Digits(integer = 8, fraction = 2, message = "Use no máximo 8 dígitos inteiros e 2 decimais.")
            BigDecimal amount,
            @NotNull(message = "Informe a data de pagamento.")
            LocalDate paymentDate,
            @NotNull(message = "Selecione o produto.")
            Integer productId,
            @NotNull(message = "Selecione o funcionário responsável.")
            Integer employeeId) {
    }

    /** fileName nulo = nota sem anexo. */
    public record InvoiceResponse(Integer id, String number, String purchasePlace, BigDecimal amount,
                                  LocalDate paymentDate, Integer productId, String productCode, String productName,
                                  Integer employeeId, String employeeName, String fileName, String fileType,
                                  Integer fileSize, Instant createdAt, Instant updatedAt) {
    }

    public record InvoiceFile(byte[] content, String name, String type) {
    }
}
