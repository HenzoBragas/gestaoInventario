package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.MovementDtos.MovementResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.dtos.ProductDtos.ProductRequest;
import com.gestaoInvetario.application.dtos.ProductDtos.ProductResponse;
import com.gestaoInvetario.application.dtos.ProductDtos.StatusRequest;
import com.gestaoInvetario.application.model.StockStatus;
import com.gestaoInvetario.application.service.ProductService;
import com.gestaoInvetario.application.service.ProductService.ProductFilter;
import com.gestaoInvetario.application.service.StockService;
import com.gestaoInvetario.application.service.StockService.MovementFilter;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService service;
    private final StockService stock;

    public ProductController(ProductService service, StockService stock) {
        this.service = service;
        this.stock = stock;
    }

    @GetMapping
    public PageResponse<ProductResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer supplierId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean missingCost,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return service.search(filter(q, categoryId, supplierId, locationId, status, missingCost, sort, direction), page, size);
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable Integer id) {
        return service.get(id);
    }

    @GetMapping("/{id}/movements")
    public PageResponse<MovementResponse> movements(@PathVariable Integer id,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "10") int size) {
        return stock.search(new MovementFilter(null, id, null, null, null, null), page, size);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable Integer id, @Valid @RequestBody ProductRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public ProductResponse setStatus(@PathVariable Integer id, @Valid @RequestBody StatusRequest request) {
        return service.setActive(id, request.active());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    static ProductFilter filter(String q, Integer categoryId, Integer supplierId, Integer locationId, String status,
                                boolean missingCost, String sort, String direction) {
        return new ProductFilter(q, categoryId, supplierId, locationId, parseStatuses(status), missingCost, sort, direction);
    }

    static Set<StockStatus> parseStatuses(String status) {
        if (status == null || status.isBlank()) {
            return EnumSet.noneOf(StockStatus.class);
        }
        return Arrays.stream(status.split(","))
                .map(String::trim)
                .filter(s -> Arrays.stream(StockStatus.values()).anyMatch(v -> v.name().equals(s)))
                .map(StockStatus::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(StockStatus.class)));
    }
}
