package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.ProductResponseDTO;
import com.gestaoInvetario.application.dtos.ProductResquestDto;
import com.gestaoInvetario.application.model.Category;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.repositories.CategoryRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class ProductService {

    @Autowired
    private ProductRepository repository;

    @Autowired
    private CategoryRepository categoryRepository;

    // GET ALL
    public ResponseEntity<List<ProductResponseDTO>> getListAll() {
        List<ProductResponseDTO> list = repository.findAll()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(list);
    }

    // GET BY ID
    public ResponseEntity<ProductResponseDTO> getById(Integer id) {
        return repository.findById(Objects.requireNonNull(id))
                .map(product -> ResponseEntity.ok(toDTO(product)))
                .orElse(ResponseEntity.notFound().build());
    }

    // CREATE
    public ResponseEntity<ProductResponseDTO> create(ProductResquestDto dto) {

        if (repository.existsByCode(dto.id())) {
            return ResponseEntity.status(409).build();
        }

        if (repository.existsByName(dto.name())) {
            return ResponseEntity.status(409).build();
        }

        Product product = new Product();

        mapToEntity(product, dto);

        Product saved = repository.save(Objects.requireNonNull(product));

        return ResponseEntity.status(201).body(toDTO(saved));
    }

    // UPDATE
    public ResponseEntity<ProductResponseDTO> edit(Integer id, ProductResquestDto dto) {

        return repository.findById(Objects.requireNonNull(id))
                .map(product -> {
                    mapToEntity(product, dto);
                    Product updated = repository.save(Objects.requireNonNull(product));
                    return ResponseEntity.ok(toDTO(updated));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // DELETE
    public void delete(Integer id) {
        if (!repository.existsById(Objects.requireNonNull(id))) {
            throw new RuntimeException("Produto não encontrado");
        }
        repository.deleteById(Objects.requireNonNull(id));
    }

    private ProductResponseDTO toDTO(Product product) {
        return new ProductResponseDTO(
                product.getId(),
                product.getCode(),
                product.getName(),
                product.getModel(),
                product.getCategory() != null ? product.getCategory().getName() : null,
                product.getStock(),
                product.getUpdatedAt()
        );
    }

    private void mapToEntity(Product product, ProductResquestDto dto) {
        if (dto.id() != null && !dto.id().isBlank()) {
            product.setCode(dto.id());
        }
        product.setName(dto.name());
        product.setModel(dto.model());
        product.setStock(dto.stock());

        if (dto.category() != null && !dto.category().isBlank()) {
            product.setCategory(resolveCategory(dto.category()));
        }
    }

    private Category resolveCategory(String name) {
        return categoryRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> categoryRepository.save(new Category(null, name, null)));
    }
}