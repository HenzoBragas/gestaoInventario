package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.CatalogDtos.SupplierRequest;
import com.gestaoInvetario.application.dtos.CatalogDtos.SupplierResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.Supplier;
import com.gestaoInvetario.application.repositories.ProductRepository;
import com.gestaoInvetario.application.repositories.SupplierRepository;
import jakarta.persistence.EntityManager;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierService {

    private final SupplierRepository repository;
    private final ProductRepository products;
    private final AuditService audit;
    private final EntityManager entityManager;

    public SupplierService(SupplierRepository repository, ProductRepository products, AuditService audit,
                           EntityManager entityManager) {
        this.repository = repository;
        this.products = products;
        this.audit = audit;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> getAll() {
        List<Object[]> rows = entityManager.createQuery(
                "select p.supplier.id, count(p) from Product p where p.supplier is not null group by p.supplier.id",
                Object[].class).getResultList();
        Map<Integer, Long> counts = rows.stream().collect(Collectors.toMap(r -> (Integer) r[0], r -> (Long) r[1]));
        return repository.findAll().stream()
                .sorted(Comparator.comparing(Supplier::getName, String.CASE_INSENSITIVE_ORDER))
                .map(s -> toDTO(s, counts.getOrDefault(s.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierResponse get(Integer id) {
        return toDTO(find(id), products.countBySupplier_Id(id));
    }

    @Transactional
    public SupplierResponse create(SupplierRequest request) {
        ensureUniqueName(request.name(), null);
        Supplier supplier = new Supplier();
        apply(supplier, request);
        Supplier saved = repository.save(supplier);
        audit.record("FORNECEDOR", saved.getId(), "CRIACAO", "Fornecedor " + saved.getName() + " cadastrado.");
        return toDTO(saved, 0);
    }

    @Transactional
    public SupplierResponse update(Integer id, SupplierRequest request) {
        Supplier supplier = find(id);
        ensureUniqueName(request.name(), id);
        boolean wasActive = supplier.isActive();
        apply(supplier, request);
        repository.save(supplier);
        String action = wasActive == supplier.isActive() ? "EDICAO" : (supplier.isActive() ? "REATIVACAO" : "DESATIVACAO");
        audit.record("FORNECEDOR", id, action, "Fornecedor " + supplier.getName() + " atualizado.");
        return toDTO(supplier, products.countBySupplier_Id(id));
    }

    @Transactional
    public void delete(Integer id) {
        Supplier supplier = find(id);
        long count = products.countBySupplier_Id(id);
        if (count > 0) {
            throw ApiException.conflict("SUPPLIER_IN_USE", "O fornecedor está vinculado a " + count
                    + " produto(s). Desative-o em vez de excluir.", null);
        }
        repository.delete(supplier);
        audit.record("FORNECEDOR", id, "EXCLUSAO", "Fornecedor " + supplier.getName() + " excluído.");
    }

    private void ensureUniqueName(String name, Integer currentId) {
        repository.findByNameIgnoreCase(name.trim()).ifPresent(existing -> {
            if (currentId == null || !existing.getId().equals(currentId)) {
                throw ApiException.conflict("SUPPLIER_EXISTS", "Já existe um fornecedor com esse nome.", "name");
            }
        });
    }

    private void apply(Supplier supplier, SupplierRequest request) {
        supplier.setName(request.name().trim());
        supplier.setTaxId(blankToNull(request.taxId()));
        supplier.setEmail(blankToNull(request.email()));
        supplier.setPhone(blankToNull(request.phone()));
        supplier.setAddress(blankToNull(request.address()));
        supplier.setNotes(blankToNull(request.notes()));
        if (request.active() != null) {
            supplier.setActive(request.active());
        }
    }

    private Supplier find(Integer id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("Fornecedor"));
    }

    private static SupplierResponse toDTO(Supplier s, long productCount) {
        return new SupplierResponse(s.getId(), s.getName(), s.getTaxId(), s.getEmail(), s.getPhone(), s.getAddress(),
                s.getNotes(), s.isActive(), productCount, s.getCreatedAt(), s.getUpdatedAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
