package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.AnalyticsDtos.Dashboard;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.GroupTotal;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.Notification;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.PeriodSummary;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.TopProduct;
import com.gestaoInvetario.application.model.MovementType;
import com.gestaoInvetario.application.service.AnalyticsService;
import com.gestaoInvetario.application.service.CsvExportService;
import com.gestaoInvetario.application.service.ProductService;
import com.gestaoInvetario.application.service.StockService;
import com.gestaoInvetario.application.service.StockService.MovementFilter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Dashboard, relatorios (JSON para pre-visualizacao e CSV para exportacao) e notificacoes. */
@RestController
public class AnalyticsController {

    private static final int MAX_EXPORT_ROWS = 50_000;

    private final AnalyticsService analytics;
    private final ProductService products;
    private final StockService stock;
    private final CsvExportService csv;

    public AnalyticsController(AnalyticsService analytics, ProductService products, StockService stock,
                               CsvExportService csv) {
        this.analytics = analytics;
        this.products = products;
        this.stock = stock;
        this.csv = csv;
    }

    @GetMapping("/dashboard")
    public Dashboard dashboard(@RequestParam(defaultValue = "30") int days) {
        return analytics.dashboard(days);
    }

    @GetMapping("/notifications")
    public List<Notification> notifications() {
        return analytics.notifications();
    }

    @GetMapping("/reports/period-summary")
    public List<PeriodSummary> periodSummary(@RequestParam Instant from, @RequestParam(required = false) Instant to,
                                             @RequestParam(defaultValue = "day") String groupBy) {
        return analytics.periodSummary(from, to, groupBy);
    }

    @GetMapping("/reports/top-products")
    public List<TopProduct> topProducts(@RequestParam Instant from, @RequestParam(required = false) Instant to,
                                        @RequestParam(defaultValue = "20") int limit) {
        return analytics.topProducts(from, to, limit);
    }

    @GetMapping("/reports/valuation")
    public List<GroupTotal> valuation(@RequestParam(defaultValue = "category") String groupBy) {
        return "location".equals(groupBy) ? analytics.valuationByLocation() : analytics.valuationByCategory();
    }

    // ------------------------------------------------------------------ CSV

    @GetMapping("/reports/inventory.csv")
    public ResponseEntity<byte[]> inventoryCsv(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer supplierId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean missingCost,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String direction) {
        var filter = ProductController.filter(q, categoryId, supplierId, locationId, status, missingCost, sort, direction);
        return file("inventario", csv.products(products.findAll(filter)));
    }

    @GetMapping("/reports/movements.csv")
    public ResponseEntity<byte[]> movementsCsv(
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) Integer productId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) String q) {
        var rows = stock.findAll(new MovementFilter(type, productId, locationId, from, to, q), MAX_EXPORT_ROWS);
        return file("movimentacoes", csv.movements(rows));
    }

    @GetMapping("/reports/period-summary.csv")
    public ResponseEntity<byte[]> periodSummaryCsv(@RequestParam Instant from, @RequestParam(required = false) Instant to,
                                                   @RequestParam(defaultValue = "day") String groupBy) {
        return file("entradas-saidas", csv.periods(analytics.periodSummary(from, to, groupBy)));
    }

    @GetMapping("/reports/top-products.csv")
    public ResponseEntity<byte[]> topProductsCsv(@RequestParam Instant from, @RequestParam(required = false) Instant to,
                                                 @RequestParam(defaultValue = "100") int limit) {
        return file("mais-movimentados", csv.topProducts(analytics.topProducts(from, to, limit)));
    }

    @GetMapping("/reports/valuation.csv")
    public ResponseEntity<byte[]> valuationCsv(@RequestParam(defaultValue = "category") String groupBy) {
        boolean byLocation = "location".equals(groupBy);
        return file(byLocation ? "valor-por-localizacao" : "valor-por-categoria",
                csv.groups(byLocation ? "Localização" : "Categoria", valuation(groupBy)));
    }

    private static ResponseEntity<byte[]> file(String name, String content) {
        String filename = name + "-" + DateTimeFormatter.ISO_LOCAL_DATE.format(LocalDate.now()) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(content.getBytes(StandardCharsets.UTF_8));
    }
}
