package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.ProductResponseDTO;
import com.gestaoInvetario.application.dtos.ProductResquestDto;
import com.gestaoInvetario.application.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin(origins = {"http://localhost:8081"})
@RequestMapping("/products")
public class ProductController {
    @Autowired
    ProductService service;

    @GetMapping
    public ResponseEntity<List<ProductResponseDTO>> getAll() {
        return service.getListAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponseDTO> getById(@PathVariable Integer id) {
        return service.getById(id);
    }

    @PostMapping
    public ResponseEntity<ProductResponseDTO> save(@RequestBody ProductResquestDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponseDTO> update(@PathVariable Integer id, @RequestBody ProductResquestDto dto) {
        return service.edit(id, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}