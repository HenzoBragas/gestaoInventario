package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.MovementDtos.MovementRequest;
import com.gestaoInvetario.application.dtos.MovementDtos.MovementResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.Location;
import com.gestaoInvetario.application.model.MovementType;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.model.Role;
import com.gestaoInvetario.application.model.StockBalance;
import com.gestaoInvetario.application.model.StockMovement;
import com.gestaoInvetario.application.repositories.LocationRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import com.gestaoInvetario.application.repositories.StockBalanceRepository;
import com.gestaoInvetario.application.repositories.StockMovementRepository;
import com.gestaoInvetario.application.security.AuthUser;
import com.gestaoInvetario.application.security.CurrentUser;
import jakarta.persistence.criteria.JoinType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Unico ponto que altera saldos. Cada movimentacao roda em uma transacao com a linha do
 * produto bloqueada (SELECT ... FOR UPDATE), o que serializa operacoes concorrentes sobre
 * o mesmo produto e mantem Product.stock == soma dos saldos por localizacao.
 */
@Service
public class StockService {

    public record MovementFilter(MovementType type, Integer productId, Integer locationId, Instant from, Instant to,
                                 String query) {
    }

    private final ProductRepository products;
    private final LocationRepository locations;
    private final StockBalanceRepository balances;
    private final StockMovementRepository movements;

    public StockService(ProductRepository products, LocationRepository locations, StockBalanceRepository balances,
                        StockMovementRepository movements) {
        this.products = products;
        this.locations = locations;
        this.balances = balances;
        this.movements = movements;
    }

    @Transactional
    public MovementResponse register(MovementRequest request) {
        AuthUser user = CurrentUser.require();
        if (request.type() == MovementType.ADJUSTMENT) {
            CurrentUser.requireRole(Role.MANAGER, "Ajustes de inventário exigem perfil de Gerente ou Administrador.");
        }

        Product product = products.findByIdForUpdate(request.productId())
                .orElseThrow(() -> ApiException.notFound("Produto"));

        // Idempotencia verificada apos o lock: reenvios do mesmo formulario devolvem o registro original.
        String key = blankToNull(request.requestKey());
        if (key != null) {
            var existing = movements.findByRequestKey(key);
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }

        if (!product.isActive()) {
            throw ApiException.unprocessable("PRODUCT_INACTIVE",
                    "Produto inativo não pode ser movimentado. Reative o cadastro antes.");
        }

        StockMovement movement = new StockMovement();
        movement.setType(request.type());
        movement.setProduct(product);
        movement.setReason(request.reason().trim());
        movement.setNotes(blankToNull(request.notes()));
        movement.setReference(blankToNull(request.reference()));
        movement.setRequestKey(key);
        movement.setUsername(user.username());
        movement.setUserDisplayName(user.name());

        switch (request.type()) {
            case IN -> applyIn(movement, product, requireQuantity(request), activeLocation(request.toLocationId(), "toLocationId", "destino"));
            case OUT -> applyOut(movement, product, requireQuantity(request), activeLocation(request.fromLocationId(), "fromLocationId", "origem"));
            case TRANSFER -> applyTransfer(movement, product, requireQuantity(request),
                    activeLocation(request.fromLocationId(), "fromLocationId", "origem"),
                    activeLocation(request.toLocationId(), "toLocationId", "destino"));
            case ADJUSTMENT -> applyAdjustment(movement, product, request);
        }

        int totalBefore = product.stockOrZero();
        int totalAfter = totalBefore + movement.getDelta();
        if (totalAfter < 0) {
            // Defesa extra: as regras por localizacao ja impedem saldo negativo.
            throw ApiException.unprocessable("NEGATIVE_STOCK", "A operação deixaria o estoque negativo.");
        }
        product.setStock(totalAfter);
        movement.setTotalBefore(totalBefore);
        movement.setTotalAfter(totalAfter);
        movement.setCreatedAt(Instant.now());

        products.save(product);
        return toResponse(movements.save(movement));
    }

    /** Usado pelo cadastro de produto para registrar o saldo inicial como movimentacao auditavel. */
    @Transactional
    public void registerInitialStock(Product product, Location location, int quantity) {
        AuthUser user = CurrentUser.require();
        StockMovement movement = new StockMovement();
        movement.setType(MovementType.IN);
        movement.setProduct(product);
        movement.setReason("Saldo inicial");
        movement.setUsername(user.username());
        movement.setUserDisplayName(user.name());
        applyIn(movement, product, quantity, location);
        movement.setTotalBefore(0);
        movement.setTotalAfter(quantity);
        movement.setCreatedAt(Instant.now());
        product.setStock(quantity);
        products.save(product);
        movements.save(movement);
    }

    private void applyIn(StockMovement movement, Product product, int quantity, Location to) {
        StockBalance balance = balanceFor(product, to);
        movement.setQuantity(quantity);
        movement.setDelta(quantity);
        movement.setToLocation(to);
        movement.setToBefore(balance.getQuantity());
        balance.setQuantity(balance.getQuantity() + quantity);
        movement.setToAfter(balance.getQuantity());
        balances.save(balance);
    }

    private void applyOut(StockMovement movement, Product product, int quantity, Location from) {
        StockBalance balance = balanceFor(product, from);
        ensureAvailable(balance, quantity, from);
        movement.setQuantity(quantity);
        movement.setDelta(-quantity);
        movement.setFromLocation(from);
        movement.setFromBefore(balance.getQuantity());
        balance.setQuantity(balance.getQuantity() - quantity);
        movement.setFromAfter(balance.getQuantity());
        balances.save(balance);
    }

    private void applyTransfer(StockMovement movement, Product product, int quantity, Location from, Location to) {
        if (from.getId().equals(to.getId())) {
            throw ApiException.unprocessable("SAME_LOCATION", "Origem e destino devem ser diferentes.", "toLocationId");
        }
        StockBalance source = balanceFor(product, from);
        StockBalance target = balanceFor(product, to);
        ensureAvailable(source, quantity, from);
        movement.setQuantity(quantity);
        movement.setDelta(0);
        movement.setFromLocation(from);
        movement.setToLocation(to);
        movement.setFromBefore(source.getQuantity());
        movement.setToBefore(target.getQuantity());
        source.setQuantity(source.getQuantity() - quantity);
        target.setQuantity(target.getQuantity() + quantity);
        movement.setFromAfter(source.getQuantity());
        movement.setToAfter(target.getQuantity());
        balances.save(source);
        balances.save(target);
    }

    private void applyAdjustment(StockMovement movement, Product product, MovementRequest request) {
        if (request.countedQuantity() == null) {
            throw ApiException.unprocessable("COUNT_REQUIRED", "Informe o saldo contado.", "countedQuantity");
        }
        Location location = activeLocation(request.locationId(), "locationId", "localização");
        StockBalance balance = balanceFor(product, location);
        int difference = request.countedQuantity() - balance.getQuantity();
        if (difference == 0) {
            throw ApiException.unprocessable("NO_DIFFERENCE",
                    "O saldo contado é igual ao saldo atual. Nenhum ajuste é necessário.", "countedQuantity");
        }
        movement.setQuantity(Math.abs(difference));
        movement.setDelta(difference);
        if (difference > 0) {
            movement.setToLocation(location);
            movement.setToBefore(balance.getQuantity());
            movement.setToAfter(request.countedQuantity());
        } else {
            movement.setFromLocation(location);
            movement.setFromBefore(balance.getQuantity());
            movement.setFromAfter(request.countedQuantity());
        }
        balance.setQuantity(request.countedQuantity());
        balances.save(balance);
    }

    private static int requireQuantity(MovementRequest request) {
        if (request.quantity() == null || request.quantity() <= 0) {
            throw ApiException.unprocessable("INVALID_QUANTITY", "A quantidade deve ser maior que zero.", "quantity");
        }
        return request.quantity();
    }

    private static void ensureAvailable(StockBalance balance, int quantity, Location location) {
        if (balance.getQuantity() < quantity) {
            throw ApiException.unprocessable("INSUFFICIENT_STOCK",
                    "Saldo insuficiente em " + location.getCode() + ": disponível " + balance.getQuantity()
                            + ", solicitado " + quantity + ".", "quantity");
        }
    }

    private Location activeLocation(Integer id, String field, String label) {
        if (id == null) {
            throw ApiException.unprocessable("LOCATION_REQUIRED", "Selecione a localização de " + label + ".", field);
        }
        Location location = locations.findById(id).orElseThrow(() -> ApiException.notFound("Localização"));
        if (!location.isActive()) {
            throw ApiException.unprocessable("LOCATION_INACTIVE", "A localização " + location.getCode() + " está inativa.", field);
        }
        return location;
    }

    private StockBalance balanceFor(Product product, Location location) {
        return balances.findByProduct_IdAndLocation_Id(product.getId(), location.getId())
                .orElseGet(() -> new StockBalance(product, location));
    }

    // ------------------------------------------------------------------ consultas

    @Transactional(readOnly = true)
    public PageResponse<MovementResponse> search(MovementFilter filter, int page, int size) {
        var result = movements.findAll(specification(filter),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return PageResponse.of(result, StockService::toResponse);
    }

    @Transactional(readOnly = true)
    public List<StockMovement> findAll(MovementFilter filter, int limit) {
        return movements.findAll(specification(filter),
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt", "id"))).getContent();
    }

    @Transactional(readOnly = true)
    public MovementResponse get(Long id) {
        return movements.findById(id).map(StockService::toResponse)
                .orElseThrow(() -> ApiException.notFound("Movimentação"));
    }

    static Specification<StockMovement> specification(MovementFilter filter) {
        List<Specification<StockMovement>> specs = new ArrayList<>();
        specs.add((root, query, cb) -> {
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                root.fetch("product", JoinType.INNER);
                root.fetch("fromLocation", JoinType.LEFT);
                root.fetch("toLocation", JoinType.LEFT);
            }
            return cb.conjunction();
        });
        if (filter.type() != null) {
            specs.add((root, q, cb) -> cb.equal(root.get("type"), filter.type()));
        }
        if (filter.productId() != null) {
            specs.add((root, q, cb) -> cb.equal(root.get("product").get("id"), filter.productId()));
        }
        if (filter.locationId() != null) {
            specs.add((root, q, cb) -> cb.or(
                    cb.equal(root.get("fromLocation").get("id"), filter.locationId()),
                    cb.equal(root.get("toLocation").get("id"), filter.locationId())));
        }
        if (filter.from() != null) {
            specs.add((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), filter.from()));
        }
        if (filter.to() != null) {
            specs.add((root, q, cb) -> cb.lessThan(root.get("createdAt"), filter.to()));
        }
        if (filter.query() != null && !filter.query().isBlank()) {
            String like = "%" + filter.query().trim().toLowerCase() + "%";
            specs.add((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("product").get("name")), like),
                    cb.like(cb.lower(root.get("product").get("code")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("reference"), "")), like),
                    cb.like(cb.lower(root.get("username")), like)));
        }
        return Specification.allOf(specs);
    }

    public static MovementResponse toResponse(StockMovement m) {
        Product p = m.getProduct();
        Location from = m.getFromLocation();
        Location to = m.getToLocation();
        return new MovementResponse(m.getId(), m.getType(), p.getId(), p.getCode(), p.getName(), p.getUnit(),
                m.getQuantity(), m.getDelta(),
                from == null ? null : from.getId(), from == null ? null : from.getCode(), from == null ? null : from.getName(),
                to == null ? null : to.getId(), to == null ? null : to.getCode(), to == null ? null : to.getName(),
                m.getReason(), m.getNotes(), m.getReference(), m.getUsername(), m.getUserDisplayName(), m.getCreatedAt(),
                m.getTotalBefore(), m.getTotalAfter(), m.getFromBefore(), m.getFromAfter(), m.getToBefore(), m.getToAfter());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
