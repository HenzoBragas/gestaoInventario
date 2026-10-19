package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.AccountDtos.SettingsRequest;
import com.gestaoInvetario.application.dtos.AccountDtos.SettingsResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.AppSettings;
import com.gestaoInvetario.application.repositories.AppSettingsRepository;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    private final AppSettingsRepository repository;
    private final AuditService audit;

    public SettingsService(AppSettingsRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    @Transactional
    public AppSettings entity() {
        return repository.findById(AppSettings.SINGLETON_ID).orElseGet(() -> repository.save(new AppSettings()));
    }

    @Transactional
    public SettingsResponse get() {
        return toResponse(entity());
    }

    @Transactional(readOnly = true)
    public ZoneId zone() {
        return repository.findById(AppSettings.SINGLETON_ID)
                .map(s -> safeZone(s.getTimeZone()))
                .orElse(ZoneId.of("America/Sao_Paulo"));
    }

    @Transactional
    public SettingsResponse update(SettingsRequest request) {
        try {
            ZoneId.of(request.timeZone());
        } catch (DateTimeException ex) {
            throw ApiException.unprocessable("INVALID_TIMEZONE", "Fuso horário inválido.", "timeZone");
        }
        AppSettings settings = entity();
        settings.setOrganizationName(request.organizationName().trim());
        settings.setTaxId(request.taxId() == null || request.taxId().isBlank() ? null : request.taxId().trim());
        settings.setCurrency(request.currency());
        settings.setLocale(request.locale());
        settings.setTimeZone(request.timeZone());
        settings.setDefaultMinStock(request.defaultMinStock());
        settings.setUnits(String.join(",", new LinkedHashSet<>(request.units())));
        repository.save(settings);
        audit.record("CONFIGURACAO", settings.getId(), "EDICAO", "Configurações da organização atualizadas.");
        return toResponse(settings);
    }

    private static ZoneId safeZone(String zone) {
        try {
            return ZoneId.of(zone);
        } catch (DateTimeException ex) {
            return ZoneId.of("America/Sao_Paulo");
        }
    }

    private static SettingsResponse toResponse(AppSettings s) {
        List<String> units = Arrays.stream(s.getUnits().split(",")).map(String::trim).filter(u -> !u.isEmpty()).toList();
        return new SettingsResponse(s.getOrganizationName(), s.getTaxId(), s.getCurrency(), s.getLocale(),
                s.getTimeZone(), s.getDefaultMinStock(), units, s.getUpdatedAt());
    }
}
