package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.MovementDtos.MovementRequest;
import com.gestaoInvetario.application.dtos.MovementDtos.MovementResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.model.MovementType;
import com.gestaoInvetario.application.service.StockService;
import com.gestaoInvetario.application.service.StockService.MovementFilter;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Somente consulta e criacao: o historico nao pode ser editado nem excluido. */
@RestController
@RequestMapping("/movements")
public class MovementController {

    private final StockService service;

    public MovementController(StockService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<MovementResponse> search(
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) Integer productId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return service.search(new MovementFilter(type, productId, locationId, from, to, q), page, size);
    }

    @GetMapping("/{id}")
    public MovementResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public ResponseEntity<MovementResponse> register(@Valid @RequestBody MovementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.register(request));
    }
}
