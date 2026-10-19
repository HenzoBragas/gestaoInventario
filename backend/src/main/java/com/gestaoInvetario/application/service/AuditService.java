package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.model.AuditLog;
import com.gestaoInvetario.application.repositories.AuditLogRepository;
import com.gestaoInvetario.application.security.CurrentUser;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    public record AuditEntry(Long id, String entity, String entityId, String action, String summary, String username, Instant createdAt) {
    }

    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    /** Registra na mesma transacao da operacao auditada. */
    @Transactional
    public void record(String entity, Object entityId, String action, String summary) {
        AuditLog log = new AuditLog();
        log.setEntity(entity);
        log.setEntityId(entityId == null ? null : String.valueOf(entityId));
        log.setAction(action);
        log.setSummary(summary.length() > 500 ? summary.substring(0, 500) : summary);
        log.setUsername(CurrentUser.usernameOrSystem());
        log.setCreatedAt(Instant.now());
        repository.save(log);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEntry> search(String entity, String query, int page, int size) {
        List<Specification<AuditLog>> specs = new ArrayList<>();
        if (entity != null && !entity.isBlank()) {
            specs.add((root, q, cb) -> cb.equal(root.get("entity"), entity));
        }
        if (query != null && !query.isBlank()) {
            String like = "%" + query.trim().toLowerCase() + "%";
            specs.add((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("summary")), like),
                    cb.like(cb.lower(root.get("username")), like)));
        }
        Specification<AuditLog> spec = Specification.allOf(specs);
        var result = repository.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return PageResponse.of(result, log -> new AuditEntry(log.getId(), log.getEntity(), log.getEntityId(),
                log.getAction(), log.getSummary(), log.getUsername(), log.getCreatedAt()));
    }
}
