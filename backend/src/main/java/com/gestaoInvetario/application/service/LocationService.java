package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.CatalogDtos.LocationBalance;
import com.gestaoInvetario.application.dtos.CatalogDtos.LocationRequest;
import com.gestaoInvetario.application.dtos.CatalogDtos.LocationResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.Location;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.repositories.LocationRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import com.gestaoInvetario.application.repositories.StockBalanceRepository;
import com.gestaoInvetario.application.repositories.StockMovementRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LocationService {

    private record Totals(long products, long units, BigDecimal value) {
        static final Totals EMPTY = new Totals(0, 0, BigDecimal.ZERO);
    }

    private final LocationRepository repository;
    private final StockBalanceRepository balances;
    private final StockMovementRepository movements;
    private final ProductRepository products;
    private final AuditService audit;
    private final EntityManager entityManager;

    public LocationService(LocationRepository repository, StockBalanceRepository balances,
                           StockMovementRepository movements, ProductRepository products, AuditService audit,
                           EntityManager entityManager) {
        this.repository = repository;
        this.balances = balances;
        this.movements = movements;
        this.products = products;
        this.audit = audit;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<LocationResponse> getAll() {
        Map<Integer, Totals> totals = totals();
        return repository.findAll().stream()
                .sorted(Comparator.comparing(Location::getCode, String.CASE_INSENSITIVE_ORDER))
                .map(l -> toDTO(l, totals.getOrDefault(l.getId(), Totals.EMPTY)))
                .toList();
    }

    @Transactional(readOnly = true)
    public LocationResponse get(Integer id) {
        return toDTO(find(id), totals().getOrDefault(id, Totals.EMPTY));
    }

    @Transactional(readOnly = true)
    public List<LocationBalance> balances(Integer id) {
        find(id);
        return balances.findNonZeroByLocationId(id).stream().map(b -> {
            Product p = b.getProduct();
            BigDecimal cost = p.unitCostOrZero();
            return new LocationBalance(p.getId(), p.getCode(), p.getName(),
                    p.getCategory() == null ? null : p.getCategory().getName(), p.getUnit(), b.getQuantity(), cost,
                    cost.multiply(BigDecimal.valueOf(b.getQuantity())));
        }).toList();
    }

    @Transactional
    public LocationResponse create(LocationRequest request) {
        String code = request.code().trim().toUpperCase();
        if (repository.findByCodeIgnoreCase(code).isPresent()) {
            throw ApiException.conflict("LOCATION_CODE_TAKEN", "Já existe uma localização com o código " + code + ".", "code");
        }
        Location location = new Location();
        apply(location, request, code);
        Location saved = repository.save(location);
        audit.record("LOCALIZACAO", saved.getId(), "CRIACAO", "Localização " + code + " — " + saved.getName() + " criada.");
        return toDTO(saved, Totals.EMPTY);
    }

    @Transactional
    public LocationResponse update(Integer id, LocationRequest request) {
        Location location = find(id);
        String code = request.code().trim().toUpperCase();
        repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw ApiException.conflict("LOCATION_CODE_TAKEN", "Já existe uma localização com o código " + code + ".", "code");
            }
        });
        boolean wasActive = location.isActive();
        boolean deactivating = wasActive && Boolean.FALSE.equals(request.active());
        if (deactivating && balances.sumQuantityByLocation(id) != 0) {
            throw ApiException.unprocessable("LOCATION_HAS_STOCK",
                    "A localização ainda possui saldo. Transfira os itens antes de desativá-la.", "active");
        }
        apply(location, request, code);
        repository.save(location);
        String action = wasActive == location.isActive() ? "EDICAO" : (location.isActive() ? "REATIVACAO" : "DESATIVACAO");
        audit.record("LOCALIZACAO", id, action, "Localização " + code + " atualizada.");
        return get(id);
    }

    @Transactional
    public void delete(Integer id) {
        Location location = find(id);
        if (movements.existsByFromLocation_IdOrToLocation_Id(id, id) || balances.sumQuantityByLocation(id) != 0
                || products.countByDefaultLocation_Id(id) > 0) {
            throw ApiException.conflict("LOCATION_IN_USE",
                    "A localização possui histórico, saldo ou produtos vinculados. Desative-a em vez de excluir.", null);
        }
        repository.delete(location);
        audit.record("LOCALIZACAO", id, "EXCLUSAO", "Localização " + location.getCode() + " excluída.");
    }

    private void apply(Location location, LocationRequest request, String code) {
        location.setCode(code);
        location.setName(request.name().trim());
        location.setType(request.type());
        location.setDescription(request.description() == null || request.description().isBlank()
                ? null : request.description().trim());
        if (request.active() != null) {
            location.setActive(request.active());
        }
    }

    private Location find(Integer id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("Localização"));
    }

    private Map<Integer, Totals> totals() {
        List<Object[]> rows = entityManager.createQuery(
                "select b.location.id, count(b), sum(b.quantity), sum(b.quantity * coalesce(p.unitCost, 0)) "
                        + "from StockBalance b join b.product p where b.quantity <> 0 group by b.location.id",
                Object[].class).getResultList();
        return rows.stream().collect(Collectors.toMap(r -> (Integer) r[0],
                r -> new Totals((Long) r[1], ((Number) r[2]).longValue(), toBigDecimal(r[3]))));
    }

    static BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal bd) return bd;
        return new BigDecimal(value.toString());
    }

    private static LocationResponse toDTO(Location l, Totals totals) {
        return new LocationResponse(l.getId(), l.getCode(), l.getName(), l.getType(), l.getDescription(), l.isActive(),
                totals.products(), totals.units(), totals.value(), l.getCreatedAt(), l.getUpdatedAt());
    }
}
