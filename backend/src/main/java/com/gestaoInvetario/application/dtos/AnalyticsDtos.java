package com.gestaoInvetario.application.dtos;

import com.gestaoInvetario.application.dtos.MovementDtos.MovementResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Dashboard, relatorios e notificacoes. Todos os valores sao calculados a partir do banco. */
public final class AnalyticsDtos {

    private AnalyticsDtos() {
    }

    public record Kpis(
            long activeProducts,
            long inactiveProducts,
            long totalUnits,
            BigDecimal inventoryValue,
            long lowStock,
            long outOfStock,
            long productsWithoutCost,
            long inUnits,
            long outUnits,
            long movementCount,
            long previousInUnits,
            long previousOutUnits,
            long previousMovementCount) {
    }

    public record DailyPoint(LocalDate date, long inUnits, long outUnits, BigDecimal inventoryValue) {
    }

    public record GroupTotal(Integer id, String label, long products, long units, BigDecimal value) {
    }

    public record TopProduct(Integer productId, String sku, String name, long inUnits, long outUnits, long total) {
    }

    public record AlertItem(Integer productId, String sku, String name, int stock, int minStock, String unit) {
    }

    public record Dashboard(
            int days,
            Instant generatedAt,
            Kpis kpis,
            List<DailyPoint> series,
            List<GroupTotal> byCategory,
            List<GroupTotal> byLocation,
            List<TopProduct> topProducts,
            List<AlertItem> lowStockItems,
            List<AlertItem> outOfStockItems,
            List<MovementResponse> recentMovements) {
    }

    public record PeriodSummary(String period, LocalDate start, long inUnits, long outUnits, long adjustments,
                                long transfers, long movements) {
    }

    public record Notification(String id, String type, String severity, String title, String description,
                               Instant createdAt, String link, Integer entityId) {
    }
}
