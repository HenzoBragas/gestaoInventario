package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.AnalyticsDtos.AlertItem;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.Dashboard;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.DailyPoint;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.GroupTotal;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.Kpis;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.Notification;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.PeriodSummary;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.TopProduct;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.model.MovementType;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.model.StockMovement;
import com.gestaoInvetario.application.model.StockStatus;
import com.gestaoInvetario.application.repositories.AppUserRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import com.gestaoInvetario.application.repositories.StockMovementRepository;
import com.gestaoInvetario.application.security.CurrentUser;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Indicadores calculados a partir dos dados persistidos. Definicoes:
 * - activeProducts: produtos distintos ativos (SKUs);
 * - totalUnits: soma dos saldos de todos os produtos (unidades fisicas);
 * - inventoryValue: soma de saldo x custo unitario atual (valorizacao a custo).
 */
@Service
public class AnalyticsService {

    public static final Set<Integer> ALLOWED_DAYS = Set.of(7, 30, 90, 180, 365);

    private final ProductRepository products;
    private final StockMovementRepository movements;
    private final AppUserRepository users;
    private final SettingsService settings;
    private final EntityManager entityManager;

    public AnalyticsService(ProductRepository products, StockMovementRepository movements, AppUserRepository users,
                            SettingsService settings, EntityManager entityManager) {
        this.products = products;
        this.movements = movements;
        this.users = users;
        this.settings = settings;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard(int days) {
        if (!ALLOWED_DAYS.contains(days)) {
            throw ApiException.unprocessable("INVALID_PERIOD", "Período não suportado.", "days");
        }
        ZoneId zone = settings.zone();
        LocalDate today = LocalDate.now(zone);
        LocalDate firstDay = today.minusDays(days - 1L);
        Instant periodStart = firstDay.atStartOfDay(zone).toInstant();
        Instant previousStart = firstDay.minusDays(days).atStartOfDay(zone).toInstant();

        List<Product> all = products.findAllWithCategory();
        Map<Integer, Product> byId = new HashMap<>();
        all.forEach(p -> byId.put(p.getId(), p));
        List<StockMovement> recentWindow = movements.findSince(previousStart);

        // ---- KPIs
        long active = 0, inactive = 0, units = 0, low = 0, out = 0, noCost = 0;
        BigDecimal value = BigDecimal.ZERO;
        for (Product p : all) {
            units += p.stockOrZero();
            value = value.add(valueOf(p, p.stockOrZero()));
            StockStatus status = p.status();
            if (p.isActive()) active++; else inactive++;
            if (status == StockStatus.LOW_STOCK) low++;
            if (status == StockStatus.OUT_OF_STOCK) out++;
            if (p.isActive() && p.unitCostOrZero().signum() == 0) noCost++;
        }
        long inUnits = 0, outUnits = 0, count = 0, prevIn = 0, prevOut = 0, prevCount = 0;
        for (StockMovement m : recentWindow) {
            boolean current = !m.getCreatedAt().isBefore(periodStart);
            long in = m.getDelta() > 0 ? m.getDelta() : 0;
            long outQty = m.getDelta() < 0 ? -m.getDelta() : 0;
            if (current) { inUnits += in; outUnits += outQty; count++; } else { prevIn += in; prevOut += outQty; prevCount++; }
        }
        Kpis kpis = new Kpis(active, inactive, units, value, low, out, noCost, inUnits, outUnits, count, prevIn, prevOut, prevCount);

        // ---- Serie diaria: entradas/saidas e valor do estoque ao fim de cada dia (reconstruido de tras para frente)
        Map<LocalDate, long[]> flows = new LinkedHashMap<>();
        Map<LocalDate, BigDecimal> valueChange = new HashMap<>();
        for (LocalDate d = firstDay; !d.isAfter(today); d = d.plusDays(1)) {
            flows.put(d, new long[2]);
        }
        for (StockMovement m : recentWindow) {
            if (m.getCreatedAt().isBefore(periodStart)) continue;
            LocalDate day = m.getCreatedAt().atZone(zone).toLocalDate();
            long[] f = flows.get(day);
            if (f == null) continue;
            if (m.getDelta() > 0) f[0] += m.getDelta(); else f[1] += -m.getDelta();
            Product p = byId.get(m.getProduct().getId());
            if (p != null && m.getDelta() != 0) {
                valueChange.merge(day, valueOf(p, m.getDelta()), BigDecimal::add);
            }
        }
        List<DailyPoint> series = new ArrayList<>();
        BigDecimal endOfDay = value;
        List<LocalDate> daysDesc = new ArrayList<>(flows.keySet());
        daysDesc.sort(Comparator.reverseOrder());
        Map<LocalDate, BigDecimal> valueAt = new HashMap<>();
        for (LocalDate d : daysDesc) {
            valueAt.put(d, endOfDay);
            endOfDay = endOfDay.subtract(valueChange.getOrDefault(d, BigDecimal.ZERO));
        }
        flows.forEach((d, f) -> series.add(new DailyPoint(d, f[0], f[1], valueAt.get(d))));

        // ---- Agrupamentos
        List<GroupTotal> byCategory = categoryTotals(all);
        List<GroupTotal> byLocation = valuationByLocation();

        // ---- Produtos mais movimentados no periodo
        Map<Integer, long[]> moved = new HashMap<>();
        for (StockMovement m : recentWindow) {
            if (m.getCreatedAt().isBefore(periodStart)) continue;
            long[] t = moved.computeIfAbsent(m.getProduct().getId(), k -> new long[3]);
            if (m.getDelta() > 0) t[0] += m.getDelta();
            if (m.getDelta() < 0) t[1] += -m.getDelta();
            t[2] += m.getQuantity();
        }
        List<TopProduct> top = moved.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue()[2], a.getValue()[2]))
                .limit(8)
                .map(e -> {
                    Product p = byId.get(e.getKey());
                    return new TopProduct(p.getId(), p.getCode(), p.getName(), e.getValue()[0], e.getValue()[1], e.getValue()[2]);
                }).toList();

        // ---- Alertas
        List<AlertItem> lowItems = all.stream().filter(p -> p.status() == StockStatus.LOW_STOCK)
                .sorted(Comparator.comparingDouble((Product p) -> (double) p.stockOrZero() / Math.max(1, p.minStockOrDefault()))
                        .thenComparing(Product::getName))
                .limit(6).map(AnalyticsService::alert).toList();
        List<AlertItem> outItems = all.stream().filter(p -> p.status() == StockStatus.OUT_OF_STOCK)
                .sorted(Comparator.comparing(Product::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(6).map(AnalyticsService::alert).toList();

        var recent = movements.findRecent(PageRequest.of(0, 8)).stream().map(StockService::toResponse).toList();

        return new Dashboard(days, Instant.now(), kpis, series, byCategory, byLocation, top, lowItems, outItems, recent);
    }

    @Transactional(readOnly = true)
    public List<GroupTotal> valuationByCategory() {
        return categoryTotals(products.findAllWithCategory());
    }

    @Transactional(readOnly = true)
    public List<GroupTotal> valuationByLocation() {
        return entityManager.createQuery(
                        "select l.id, l.code, l.name, count(b), sum(b.quantity), sum(b.quantity * coalesce(p.unitCost, 0)) "
                                + "from StockBalance b join b.location l join b.product p where b.quantity <> 0 "
                                + "group by l.id, l.code, l.name", Object[].class)
                .getResultList().stream()
                .map(r -> new GroupTotal((Integer) r[0], r[1] + " · " + r[2], (Long) r[3], ((Number) r[4]).longValue(),
                        LocationService.toBigDecimal(r[5])))
                .sorted(Comparator.comparing(GroupTotal::value).reversed()).toList();
    }

    private static List<GroupTotal> categoryTotals(List<Product> all) {
        Map<Integer, GroupTotal> categories = new LinkedHashMap<>();
        for (Product p : all) {
            if (p.getCategory() == null) continue;
            Integer id = p.getCategory().getSeq();
            GroupTotal prev = categories.getOrDefault(id, new GroupTotal(id, p.getCategory().getName(), 0, 0, BigDecimal.ZERO));
            categories.put(id, new GroupTotal(id, prev.label(), prev.products() + 1, prev.units() + p.stockOrZero(),
                    prev.value().add(valueOf(p, p.stockOrZero()))));
        }
        return categories.values().stream().sorted(Comparator.comparing(GroupTotal::value).reversed()).toList();
    }

    /** Entradas/saidas agregadas por dia, semana ou mes, para o relatorio de periodo. */
    @Transactional(readOnly = true)
    public List<PeriodSummary> periodSummary(Instant from, Instant to, String groupBy) {
        ZoneId zone = settings.zone();
        Map<LocalDate, long[]> buckets = new LinkedHashMap<>();
        for (StockMovement m : movements.findSince(from)) {
            if (to != null && !m.getCreatedAt().isBefore(to)) continue;
            LocalDate day = m.getCreatedAt().atZone(zone).toLocalDate();
            LocalDate key = switch (groupBy == null ? "day" : groupBy) {
                case "week" -> day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                case "month" -> day.withDayOfMonth(1);
                default -> day;
            };
            long[] b = buckets.computeIfAbsent(key, k -> new long[5]);
            if (m.getType() == MovementType.TRANSFER) b[3]++;
            else if (m.getType() == MovementType.ADJUSTMENT) b[2]++;
            if (m.getDelta() > 0) b[0] += m.getDelta();
            if (m.getDelta() < 0) b[1] += -m.getDelta();
            b[4]++;
        }
        List<PeriodSummary> result = new ArrayList<>();
        buckets.forEach((start, b) -> result.add(new PeriodSummary(label(start, groupBy), start, b[0], b[1], b[2], b[3], b[4])));
        return result;
    }

    @Transactional(readOnly = true)
    public List<TopProduct> topProducts(Instant from, Instant to, int limit) {
        Map<Integer, long[]> moved = new HashMap<>();
        Map<Integer, Product> productById = new HashMap<>();
        for (StockMovement m : movements.findSince(from)) {
            if (to != null && !m.getCreatedAt().isBefore(to)) continue;
            productById.putIfAbsent(m.getProduct().getId(), m.getProduct());
            long[] t = moved.computeIfAbsent(m.getProduct().getId(), k -> new long[3]);
            if (m.getDelta() > 0) t[0] += m.getDelta();
            if (m.getDelta() < 0) t[1] += -m.getDelta();
            t[2] += m.getQuantity();
        }
        return moved.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue()[2], a.getValue()[2]))
                .limit(Math.min(Math.max(limit, 1), 500))
                .map(e -> {
                    Product p = productById.get(e.getKey());
                    return new TopProduct(p.getId(), p.getCode(), p.getName(), e.getValue()[0], e.getValue()[1], e.getValue()[2]);
                }).toList();
    }

    /** Notificacoes do usuario atual, filtradas pelas preferencias salvas no perfil. */
    @Transactional(readOnly = true)
    public List<Notification> notifications() {
        AppUser user = users.findById(CurrentUser.require().id()).orElseThrow(() -> ApiException.notFound("Usuário"));
        List<Notification> list = new ArrayList<>();
        List<Product> all = products.findAllWithCategory();
        if (user.isNotifyOutOfStock()) {
            all.stream().filter(p -> p.status() == StockStatus.OUT_OF_STOCK)
                    .sorted(Comparator.comparing(Product::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(10)
                    .forEach(p -> list.add(new Notification("out-" + p.getId() + "-" + time(p), "OUT_OF_STOCK", "critical",
                            "Sem estoque: " + p.getName(), "SKU " + p.getCode() + " está com saldo zerado.",
                            time(p), "/products/" + p.getId(), p.getId())));
        }
        if (user.isNotifyLowStock()) {
            all.stream().filter(p -> p.status() == StockStatus.LOW_STOCK)
                    .sorted(Comparator.comparing(Product::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(10)
                    .forEach(p -> list.add(new Notification("low-" + p.getId() + "-" + time(p), "LOW_STOCK", "warning",
                            "Estoque baixo: " + p.getName(), p.stockOrZero() + " " + p.getUnit() + " disponíveis (mínimo "
                                    + p.minStockOrDefault() + ").", time(p), "/products/" + p.getId(), p.getId())));
        }
        if (user.isNotifyMovements()) {
            Instant since = Instant.now().minus(7, ChronoUnit.DAYS);
            movements.findRecent(PageRequest.of(0, 15)).stream()
                    .filter(m -> m.getCreatedAt().isAfter(since))
                    .filter(m -> !m.getUsername().equalsIgnoreCase(user.getUsername()))
                    .limit(10)
                    .forEach(m -> list.add(new Notification("mov-" + m.getId(), "MOVEMENT", "info",
                            movementTitle(m), m.getQuantity() + " " + m.getProduct().getUnit() + " · " + m.getProduct().getName()
                                    + " · por " + (m.getUserDisplayName() != null ? m.getUserDisplayName() : m.getUsername()),
                            m.getCreatedAt(), "/movements?movementId=" + m.getId(), m.getId().intValue())));
        }
        list.sort(Comparator.comparing(Notification::createdAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return list;
    }

    private static String movementTitle(StockMovement m) {
        return switch (m.getType()) {
            case IN -> "Entrada registrada";
            case OUT -> "Saída registrada";
            case TRANSFER -> "Transferência registrada";
            case ADJUSTMENT -> "Ajuste de inventário";
        };
    }

    private static Instant time(Product p) {
        return p.getUpdatedAt() == null ? Instant.EPOCH : p.getUpdatedAt().toInstant();
    }

    private static String label(LocalDate start, String groupBy) {
        if ("month".equals(groupBy)) return String.format("%02d/%d", start.getMonthValue(), start.getYear());
        if ("week".equals(groupBy)) return "Semana de " + String.format("%02d/%02d", start.getDayOfMonth(), start.getMonthValue());
        return String.format("%02d/%02d/%d", start.getDayOfMonth(), start.getMonthValue(), start.getYear());
    }

    private static BigDecimal valueOf(Product p, int quantity) {
        return p.unitCostOrZero().multiply(BigDecimal.valueOf(quantity));
    }

    private static AlertItem alert(Product p) {
        return new AlertItem(p.getId(), p.getCode(), p.getName(), p.stockOrZero(), p.minStockOrDefault(), p.getUnit());
    }
}
