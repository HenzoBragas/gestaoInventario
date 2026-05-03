package com.gestaoInvetario.application.service;

import com.gestaoInvetario.application.dtos.CategoryResponseDTO;
import com.gestaoInvetario.application.dtos.CategoryRequestDTO;
import com.gestaoInvetario.application.model.Category;
import com.gestaoInvetario.application.repositories.CategoryRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CategoryService {
    @Autowired
    CategoryRepository repository;
    
    @Autowired
    ProductRepository productRepository;

    public ResponseEntity<List<CategoryResponseDTO>> getAll() {
        try {
            List<Category> categories = repository.findAll();
            List<CategoryResponseDTO> response = categories.stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    public ResponseEntity<CategoryResponseDTO> getById(Integer id) {
        try {
            return repository.findById(id)
                    .map(category -> ResponseEntity.ok(toDTO(category)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    public ResponseEntity<CategoryResponseDTO> create(CategoryRequestDTO dto) {
        try {
            // Check if category with same name already exists
            if (repository.findByNameIgnoreCase(dto.getName()).isPresent()) {
                return ResponseEntity.status(HttpStatus.CONFLICT).build();
            }

            Category category = new Category();
            category.setName(dto.getName());
            category.setInactive(dto.getInactive() != null ? dto.getInactive() : 0);

            Category saved = repository.save(category);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDTO(saved));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    public ResponseEntity<CategoryResponseDTO> update(Integer id, CategoryRequestDTO dto) {
        try {
            var optional = repository.findById(id);
            if (!optional.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            Category category = optional.get();
            // Check if another category with same name exists
            var existing = repository.findByNameIgnoreCase(dto.getName());
            if (existing.isPresent() && !existing.get().getSeq().equals(id)) {
                return ResponseEntity.status(HttpStatus.CONFLICT).build();
            }

            category.setName(dto.getName());
            category.setInactive(dto.getInactive() != null ? dto.getInactive() : 0);

            Category updated = repository.save(category);
            return ResponseEntity.ok(toDTO(updated));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    public ResponseEntity<Void> delete(Integer id) {
        try {
            var optional = repository.findById(id);
            if (!optional.isPresent()) {
                return ResponseEntity.notFound().build();
            }
            
            Category category = optional.get();
            
            // Check if there are products using this category
            long productCount = productRepository.countByCategory_Seq(category.getSeq());
            if (productCount > 0) {
                // Soft delete: mark as inactive instead of deleting
                category.setInactive(1);
                repository.save(category);
                return ResponseEntity.noContent().build();
            }
            
            // If no products using this category, perform hard delete
            repository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private CategoryResponseDTO toDTO(Category category) {
        return new CategoryResponseDTO(category.getSeq(), category.getName(), category.getInactive());
    }
}
