package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.Supplier;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, Integer> {
    Optional<Supplier> findByNameIgnoreCase(String name);
}
