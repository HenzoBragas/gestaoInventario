package com.gestaoInvetario.application.dtos;

import com.gestaoInvetario.application.model.Marketplace;
import com.gestaoInvetario.application.model.MarketplaceOrderStatus;
import java.time.Instant;

public final class MarketplaceDtos {

    private MarketplaceDtos() {
    }

    public record MarketplaceOrderResponse(
            Long id,
            Marketplace marketplace,
            String marketplaceLabel,
            String externalOrderId,
            String externalStatus,
            MarketplaceOrderStatus status,
            int attempts,
            String lastError,
            String summary,
            Instant receivedAt,
            Instant lastNotificationAt,
            Instant nextAttemptAt,
            Instant processedAt) {
    }
}
