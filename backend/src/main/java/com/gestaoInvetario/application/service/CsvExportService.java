package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.AnalyticsDtos.GroupTotal;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.PeriodSummary;
import com.gestaoInvetario.application.dtos.AnalyticsDtos.TopProduct;
import com.gestaoInvetario.application.dtos.ProductDtos.ProductResponse;
import com.gestaoInvetario.application.model.StockMovement;
import com.gestaoInvetario.application.model.StockStatus;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Gera CSV compativel com Excel pt-BR: separador ";", decimal com virgula e BOM UTF-8. */
@Service
public class CsvExportService {

    private static final String BOM = "﻿";
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final SettingsService settings;

    public CsvExportService(SettingsService settings) {
        this.settings = settings;
    }

    public String products(List<ProductResponse> rows) {
        ZoneId zone = settings.zone();
        StringBuilder sb = header("SKU", "Produto", "Modelo", "Categoria", "Fornecedor", "Localizações", "Unidade",
                "Quantidade", "Estoque mínimo", "Custo unitário", "Valor em estoque", "Status", "Ativo", "Última atualização");
        for (ProductResponse p : rows) {
            String locations = p.locations().stream().map(l -> l.code() + ": " + l.quantity()).collect(Collectors.joining(", "));
            line(sb, p.sku(), p.name(), p.model(), p.categoryName(), p.supplierName(), locations, p.unit(),
                    p.stock(), p.minStock(), money(p.unitCost()), money(p.stockValue()), status(p.status()),
                    p.active() ? "Sim" : "Não", date(p.updatedAt(), zone));
        }
        return sb.toString();
    }

    public String movements(List<StockMovement> rows) {
        ZoneId zone = settings.zone();
        StringBuilder sb = header("ID", "Data/hora", "Tipo", "SKU", "Produto", "Quantidade", "Variação no total",
                "Origem", "Destino", "Saldo total anterior", "Saldo total posterior", "Motivo", "Referência",
                "Observações", "Usuário");
        for (StockMovement m : rows) {
            line(sb, m.getId(), date(m.getCreatedAt(), zone), type(m), m.getProduct().getCode(), m.getProduct().getName(),
                    m.getQuantity(), m.getDelta(),
                    m.getFromLocation() == null ? "" : m.getFromLocation().getCode(),
                    m.getToLocation() == null ? "" : m.getToLocation().getCode(),
                    m.getTotalBefore(), m.getTotalAfter(), m.getReason(), m.getReference(), m.getNotes(),
                    m.getUserDisplayName() != null ? m.getUserDisplayName() + " (" + m.getUsername() + ")" : m.getUsername());
        }
        return sb.toString();
    }

    public String groups(String groupLabel, List<GroupTotal> rows) {
        StringBuilder sb = header(groupLabel, "Produtos", "Unidades", "Valor");
        for (GroupTotal g : rows) {
            line(sb, g.label(), g.products(), g.units(), money(g.value()));
        }
        return sb.toString();
    }

    public String periods(List<PeriodSummary> rows) {
        StringBuilder sb = header("Período", "Entradas (un.)", "Saídas (un.)", "Ajustes", "Transferências", "Movimentações");
        for (PeriodSummary p : rows) {
            line(sb, p.period(), p.inUnits(), p.outUnits(), p.adjustments(), p.transfers(), p.movements());
        }
        return sb.toString();
    }

    public String topProducts(List<TopProduct> rows) {
        StringBuilder sb = header("SKU", "Produto", "Entradas (un.)", "Saídas (un.)", "Volume movimentado");
        for (TopProduct t : rows) {
            line(sb, t.sku(), t.name(), t.inUnits(), t.outUnits(), t.total());
        }
        return sb.toString();
    }

    private static StringBuilder header(String... columns) {
        StringBuilder sb = new StringBuilder(BOM);
        line(sb, (Object[]) columns);
        return sb;
    }

    private static void line(StringBuilder sb, Object... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) sb.append(';');
            sb.append(escape(values[i]));
        }
        sb.append("\r\n");
    }

    /** Escapa aspas/separadores e neutraliza injecao de formulas (=, +, -, @) ao abrir no Excel. */
    private static String escape(Object value) {
        if (value == null) return "";
        String text = value.toString();
        if (!(value instanceof Number) && !text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0) {
            text = "'" + text;
        }
        if (text.contains(";") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
            text = "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }

    private static String money(BigDecimal value) {
        return value == null ? "" : value.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private static String date(Instant instant, ZoneId zone) {
        return instant == null ? "" : DATE_TIME.format(instant.atZone(zone));
    }

    private static String status(StockStatus status) {
        return switch (status) {
            case IN_STOCK -> "Em estoque";
            case LOW_STOCK -> "Estoque baixo";
            case OUT_OF_STOCK -> "Sem estoque";
            case INACTIVE -> "Inativo";
        };
    }

    private static String type(StockMovement m) {
        return switch (m.getType()) {
            case IN -> "Entrada";
            case OUT -> "Saída";
            case TRANSFER -> "Transferência";
            case ADJUSTMENT -> "Ajuste";
        };
    }
}
