package com.gestaoInvetario.application.dtos;

import com.gestaoInvetario.application.model.MovementType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class MovementDtos {

    private MovementDtos() {
    }

    /**
     * IN: toLocationId + quantity. OUT: fromLocationId + quantity.
     * TRANSFER: fromLocationId + toLocationId + quantity.
     * ADJUSTMENT: locationId + countedQuantity (saldo contado fisicamente).
     */
    public record MovementRequest(
            @NotNull(message = "Selecione o tipo de movimentação.")
            MovementType type,
            @NotNull(message = "Selecione o produto.")
            Integer productId,
            @Min(value = 1, message = "A quantidade deve ser maior que zero.")
            Integer quantity,
            @Min(value = 0, message = "O saldo contado não pode ser negativo.")
            Integer countedQuantity,
            Integer fromLocationId,
            Integer toLocationId,
            Integer locationId,
            @NotBlank(message = "Informe o motivo.")
            @Size(max = 60, message = "O motivo deve ter no máximo 60 caracteres.")
            String reason,
            @Size(max = 1000, message = "As observações devem ter no máximo 1000 caracteres.")
            String notes,
            @Size(max = 60, message = "A referência deve ter no máximo 60 caracteres.")
            String reference,
            @Size(max = 64)
            String requestKey) {
    }

    public record MovementResponse(
            Long id,
            MovementType type,
            Integer productId,
            String productSku,
            String productName,
            String unit,
            int quantity,
            int delta,
            Integer fromLocationId,
            String fromLocationCode,
            String fromLocationName,
            Integer toLocationId,
            String toLocationCode,
            String toLocationName,
            String reason,
            String notes,
            String reference,
            String username,
            String userDisplayName,
            Instant createdAt,
            int totalBefore,
            int totalAfter,
            Integer fromBefore,
            Integer fromAfter,
            Integer toBefore,
            Integer toAfter) {
    }
}
