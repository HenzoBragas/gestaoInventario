package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.dtos.ProductDtos.LocationQuantity;
import com.gestaoInvetario.application.dtos.ProductDtos.ProductRequest;
import com.gestaoInvetario.application.dtos.ProductDtos.ProductResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.model.Category;
import com.gestaoInvetario.application.model.Location;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.model.StockBalance;
import com.gestaoInvetario.application.model.StockStatus;
import com.gestaoInvetario.application.model.Supplier;
import com.gestaoInvetario.application.repositories.CategoryRepository;
import com.gestaoInvetario.application.repositories.LocationRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import com.gestaoInvetario.application.repositories.StockBalanceRepository;
import com.gestaoInvetario.application.repositories.StockMovementRepository;
import com.gestaoInvetario.application.repositories.SupplierRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {

    /** Filtros combinaveis da listagem de inventario/produtos. */
    public record ProductFilter(String query, Integer categoryId, Integer supplierId, Integer locationId,
                                Set<StockStatus> statuses, boolean missingCost, String sort, String direction) {
    }

    private static final Set<String> SORTABLE = Set.of("sku", "name", "category", "stock", "minStock", "unitCost",
            "value", "updatedAt", "createdAt");

    private final ProductRepository repository;
    private final CategoryRepository categories;
    private final SupplierRepository suppliers;
    private final LocationRepository locations;
    private final StockBalanceRepository balances;
    private final StockMovementRepository movements;
    private final StockService stock;
    private final AuditService audit;

    public ProductService(ProductRepository repository, CategoryRepository categories, SupplierRepository suppliers,
                          LocationRepository locations, StockBalanceRepository balances,
                          StockMovementRepository movements, StockService stock, AuditService audit) {
        this.repository = repository;
        this.categories = categories;
        this.suppliers = suppliers;
        this.locations = locations;
        this.balances = balances;
        this.movements = movements;
        this.stock = stock;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ consultas

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> search(ProductFilter filter, int page, int size) {
        var result = repository.findAll(specification(filter),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        Map<Integer, List<LocationQuantity>> byProduct = locationsFor(
                result.getContent().stream().map(Product::getId).toList());
        return PageResponse.of(result, p -> toResponse(p, byProduct.getOrDefault(p.getId(), List.of())));
    }

    /** Lista completa (sem paginacao) para exportacoes. */
    @Transactional(readOnly = true)
    public List<ProductResponse> findAll(ProductFilter filter) {
        List<Product> list = repository.findAll(specification(filter));
        Map<Integer, List<LocationQuantity>> byProduct = locationsFor(list.stream().map(Product::getId).toList());
        return list.stream().map(p -> toResponse(p, byProduct.getOrDefault(p.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse get(Integer id) {
        Product product = find(id);
        List<LocationQuantity> all = balances.findByProductId(id).stream()
                .map(ProductService::toLocationQuantity).toList();
        return toResponse(product, all);
    }

    // ------------------------------------------------------------------ escrita

    @Transactional
    public ProductResponse create(ProductRequest request) {
        String sku = request.sku().trim();
        if (repository.existsByCodeIgnoreCase(sku)) {
            throw ApiException.conflict("SKU_TAKEN", "Já existe um produto com o SKU " + sku + ".", "sku");
        }
        int initial = request.initialQuantity() == null ? 0 : request.initialQuantity();
        Product product = new Product();
        product.setStock(0);
        product.setCreatedAt(new Date());
        apply(product, request);
        if (request.active() != null) {
            product.setActive(request.active());
        }
        Product saved = repository.save(product);

        if (initial > 0) {
            if (saved.getDefaultLocation() == null) {
                throw ApiException.unprocessable("LOCATION_REQUIRED",
                        "Selecione a localização padrão para registrar a quantidade inicial.", "defaultLocationId");
            }
            if (!saved.isActive()) {
                throw ApiException.unprocessable("PRODUCT_INACTIVE",
                        "Um produto inativo não pode receber quantidade inicial.", "initialQuantity");
            }
            stock.registerInitialStock(saved, saved.getDefaultLocation(), initial);
        }
        audit.record("PRODUTO", saved.getId(), "CRIACAO", "Produto " + saved.getCode() + " — " + saved.getName()
                + " cadastrado" + (initial > 0 ? " com saldo inicial de " + initial + " " + saved.getUnit() : "") + ".");
        return get(saved.getId());
    }

    /** Edicao de cadastro: ignora qualquer tentativa de alterar saldo (use movimentacoes). */
    @Transactional
    public ProductResponse update(Integer id, ProductRequest request) {
        Product product = find(id);
        String sku = request.sku().trim();
        if (repository.existsByCodeIgnoreCaseAndIdNot(sku, id)) {
            throw ApiException.conflict("SKU_TAKEN", "Já existe um produto com o SKU " + sku + ".", "sku");
        }
        apply(product, request);
        if (request.active() != null) {
            product.setActive(request.active());
        }
        repository.save(product);
        audit.record("PRODUTO", id, "EDICAO", "Cadastro do produto " + product.getCode() + " atualizado.");
        return get(id);
    }

    @Transactional
    public ProductResponse setActive(Integer id, boolean active) {
        Product product = find(id);
        product.setActive(active);
        repository.save(product);
        audit.record("PRODUTO", id, active ? "REATIVACAO" : "DESATIVACAO",
                "Produto " + product.getCode() + (active ? " reativado." : " desativado."));
        return get(id);
    }

    /**
     * Exclusao definitiva so e permitida para produtos sem historico e sem saldo;
     * caso contrario, o produto deve ser desativado (preserva a auditoria).
     */
    @Transactional
    public void delete(Integer id) {
        Product product = find(id);
        if (movements.countByProduct_Id(id) > 0 || product.stockOrZero() != 0) {
            throw ApiException.conflict("PRODUCT_HAS_HISTORY",
                    "Este produto possui movimentações ou saldo. Desative-o em vez de excluir.", null);
        }
        balances.findByProductId(id).forEach(balances::delete);
        repository.delete(product);
        audit.record("PRODUTO", id, "EXCLUSAO", "Produto " + product.getCode() + " — " + product.getName() + " excluído.");
    }

    // ------------------------------------------------------------------ mapeamento

    private void apply(Product product, ProductRequest request) {
        product.setCode(request.sku().trim());
        product.setName(request.name().trim());
        product.setModel(isBlank(request.model()) ? "Sem modelo" : request.model().trim());
        product.setBarcode(blankToNull(request.barcode()));
        product.setDescription(blankToNull(request.description()));
        product.setCategory(activeCategory(request.categoryId(), product.getCategory()));
        product.setSupplier(request.supplierId() == null ? null : supplier(request.supplierId(), product.getSupplier()));
        product.setUnit(request.unit().trim().toUpperCase());
        product.setUnitCost(request.unitCost());
        product.setSalePrice(request.salePrice());
        product.setMinStock(request.minStock());
        product.setDefaultLocation(request.defaultLocationId() == null ? null
                : location(request.defaultLocationId(), product.getDefaultLocation()));
        product.setImageUrl(blankToNull(request.imageUrl()));
    }

    /** Aceita manter um vinculo existente mesmo inativo, mas nao criar um novo vinculo com registro inativo. */
    private Category activeCategory(Integer id, Category current) {
        Category category = categories.findById(id).orElseThrow(() -> ApiException.notFound("Categoria"));
        if (!category.isActive() && (current == null || !current.getSeq().equals(id))) {
            throw ApiException.unprocessable("CATEGORY_INACTIVE", "A categoria selecionada está inativa.", "categoryId");
        }
        return category;
    }

    private Supplier supplier(Integer id, Supplier current) {
        Supplier supplier = suppliers.findById(id).orElseThrow(() -> ApiException.notFound("Fornecedor"));
        if (!supplier.isActive() && (current == null || !current.getId().equals(id))) {
            throw ApiException.unprocessable("SUPPLIER_INACTIVE", "O fornecedor selecionado está inativo.", "supplierId");
        }
        return supplier;
    }

    private Location location(Integer id, Location current) {
        Location location = locations.findById(id).orElseThrow(() -> ApiException.notFound("Localização"));
        if (!location.isActive() && (current == null || !current.getId().equals(id))) {
            throw ApiException.unprocessable("LOCATION_INACTIVE", "A localização selecionada está inativa.", "defaultLocationId");
        }
        return location;
    }

    private Product find(Integer id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("Produto"));
    }

    private Map<Integer, List<LocationQuantity>> locationsFor(Collection<Integer> productIds) {
        if (productIds.isEmpty()) {
            return Map.of();
        }
        return balances.findNonZeroByProductIds(productIds).stream()
                .collect(Collectors.groupingBy(b -> b.getProduct().getId(),
                        Collectors.mapping(ProductService::toLocationQuantity, Collectors.toList())));
    }

    private static LocationQuantity toLocationQuantity(StockBalance b) {
        return new LocationQuantity(b.getLocation().getId(), b.getLocation().getCode(), b.getLocation().getName(),
                b.getQuantity());
    }

    public static ProductResponse toResponse(Product p, List<LocationQuantity> locations) {
        Category category = p.getCategory();
        Supplier supplier = p.getSupplier();
        Location defaultLocation = p.getDefaultLocation();
        BigDecimal value = p.unitCostOrZero().multiply(BigDecimal.valueOf(p.stockOrZero()));
        return new ProductResponse(p.getId(), p.getCode(), p.getName(), p.getModel(), p.getBarcode(),
                p.getDescription(),
                category == null ? null : category.getSeq(), category == null ? null : category.getName(),
                supplier == null ? null : supplier.getId(), supplier == null ? null : supplier.getName(),
                p.getUnit() == null ? "UN" : p.getUnit(), p.unitCostOrZero(), p.getSalePrice(), p.minStockOrDefault(),
                defaultLocation == null ? null : defaultLocation.getId(),
                defaultLocation == null ? null : defaultLocation.getName(),
                p.getImageUrl(), p.isActive(), p.stockOrZero(), p.status(), value,
                toInstant(p.getCreatedAt()), toInstant(p.getUpdatedAt()), locations);
    }

    private static Instant toInstant(Date date) {
        return date == null ? null : date.toInstant();
    }

    // ------------------------------------------------------------------ specification

    static Specification<Product> specification(ProductFilter filter) {
        return (root, query, cb) -> {
            boolean isCount = query != null && (query.getResultType() == Long.class || query.getResultType() == long.class);
            List<Predicate> predicates = new ArrayList<>();

            if (!isCount && query != null) {
                root.fetch("category", JoinType.LEFT);
                root.fetch("supplier", JoinType.LEFT);
                root.fetch("defaultLocation", JoinType.LEFT);
            }

            if (filter.query() != null && !filter.query().isBlank()) {
                String like = "%" + filter.query().trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("code")), like),
                        cb.like(cb.lower(root.get("model")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("barcode"), "")), like)));
            }
            if (filter.categoryId() != null) {
                predicates.add(cb.equal(root.get("category").get("seq"), filter.categoryId()));
            }
            if (filter.supplierId() != null) {
                predicates.add(cb.equal(root.get("supplier").get("id"), filter.supplierId()));
            }
            if (filter.locationId() != null && query != null) {
                Subquery<Long> sub = query.subquery(Long.class);
                Root<StockBalance> balance = sub.from(StockBalance.class);
                sub.select(balance.get("id")).where(
                        cb.equal(balance.get("product"), root),
                        cb.equal(balance.get("location").get("id"), filter.locationId()),
                        cb.notEqual(balance.get("quantity"), 0));
                predicates.add(cb.exists(sub));
            }
            if (filter.missingCost()) {
                predicates.add(cb.equal(cb.coalesce(root.get("unitCost"), BigDecimal.ZERO), BigDecimal.ZERO));
            }
            if (filter.statuses() != null && !filter.statuses().isEmpty()) {
                predicates.add(cb.or(filter.statuses().stream()
                        .map(status -> statusPredicate(status, root, cb)).toArray(Predicate[]::new)));
            }

            if (!isCount && query != null) {
                query.orderBy(order(filter, root, cb));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Predicate statusPredicate(StockStatus status, Root<Product> root, CriteriaBuilder cb) {
        Predicate active = cb.or(cb.isNull(root.get("active")), cb.isTrue(root.get("active")));
        Expression<Integer> stock = cb.coalesce(root.<Integer>get("stock"), 0);
        Expression<Integer> min = cb.coalesce(root.<Integer>get("minStock"), 5);
        return switch (status) {
            case INACTIVE -> cb.isFalse(root.get("active"));
            case OUT_OF_STOCK -> cb.and(active, cb.le(stock, 0));
            case LOW_STOCK -> cb.and(active, cb.gt(stock, 0), cb.le(stock, min));
            case IN_STOCK -> cb.and(active, cb.gt(stock, min));
        };
    }

    private static List<Order> order(ProductFilter filter, Root<Product> root, CriteriaBuilder cb) {
        String field = filter.sort() != null && SORTABLE.contains(filter.sort()) ? filter.sort() : "name";
        boolean desc = "desc".equalsIgnoreCase(filter.direction());
        Expression<?> expression = switch (field) {
            case "sku" -> root.get("code");
            case "category" -> root.get("category").get("name");
            case "value" -> cb.prod(cb.coalesce(root.<Integer>get("stock"), 0),
                    cb.coalesce(root.<BigDecimal>get("unitCost"), BigDecimal.ZERO));
            default -> root.get(field);
        };
        Order primary = desc ? cb.desc(expression) : cb.asc(expression);
        return List.of(primary, cb.asc(root.get("id")));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }
}
