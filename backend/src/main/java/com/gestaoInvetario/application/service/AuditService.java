package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.model.AuditLog;
import com.gestaoInvetario.application.repositories.AppUserRepository;
import com.gestaoInvetario.application.repositories.AuditLogRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Consulta da tabela Auditoria (gravada pelos triggers do banco, ver db/auditoria-triggers.sql). */
@Service
public class AuditService {

    public record AuditEntry(Integer id, String table, String field, String oldValue, String newValue,
                             Instant changedAt, Integer employeeId, String employeeName, String dbUser) {
    }

    private final AuditLogRepository repository;
    private final AppUserRepository users;

    public AuditService(AuditLogRepository repository, AppUserRepository users) {
        this.repository = repository;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEntry> search(String table, Integer employeeId, String query, Instant from, Instant to,
                                           int page, int size) {
        List<Specification<AuditLog>> specs = new ArrayList<>();
        if (table != null && !table.isBlank()) {
            specs.add((root, q, cb) -> cb.equal(root.get("table"), table));
        }
        if (employeeId != null) {
            specs.add((root, q, cb) -> cb.equal(root.get("employeeId"), employeeId));
        }
        if (query != null && !query.isBlank()) {
            String like = "%" + query.trim().toLowerCase() + "%";
            specs.add((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("field")), like),
                    cb.like(cb.lower(root.get("oldValue")), like),
                    cb.like(cb.lower(root.get("newValue")), like),
                    cb.like(cb.lower(root.get("dbUser")), like)));
        }
        if (from != null) {
            specs.add((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("changedAt"), from));
        }
        if (to != null) {
            specs.add((root, q, cb) -> cb.lessThan(root.get("changedAt"), to));
        }
        Page<AuditLog> result = repository.findAll(Specification.allOf(specs),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by(Sort.Direction.DESC, "changedAt", "id")));

        List<Integer> ids = result.getContent().stream().map(AuditLog::getEmployeeId).filter(Objects::nonNull).distinct().toList();
        Map<Integer, String> names = users.findAllById(ids).stream().collect(Collectors.toMap(AppUser::getId, AppUser::getName));
        return PageResponse.of(result, log -> new AuditEntry(log.getId(), log.getTable(), log.getField(),
                log.getOldValue(), log.getNewValue(), log.getChangedAt(), log.getEmployeeId(),
                log.getEmployeeId() == null ? null : names.get(log.getEmployeeId()), log.getDbUser()));
    }
}
