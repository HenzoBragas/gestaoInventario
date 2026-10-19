package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.CatalogDtos.LocationBalance;
import com.gestaoInvetario.application.dtos.CatalogDtos.LocationRequest;
import com.gestaoInvetario.application.dtos.CatalogDtos.LocationResponse;
import com.gestaoInvetario.application.service.LocationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/locations")
public class LocationController {

    private final LocationService service;

    public LocationController(LocationService service) {
        this.service = service;
    }

    @GetMapping
    public List<LocationResponse> getAll() {
        return service.getAll();
    }

    @GetMapping("/{id}")
    public LocationResponse get(@PathVariable Integer id) {
        return service.get(id);
    }

    @GetMapping("/{id}/balances")
    public List<LocationBalance> balances(@PathVariable Integer id) {
        return service.balances(id);
    }

    @PostMapping
    public ResponseEntity<LocationResponse> create(@Valid @RequestBody LocationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public LocationResponse update(@PathVariable Integer id, @Valid @RequestBody LocationRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
