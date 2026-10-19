package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.Location;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationRepository extends JpaRepository<Location, Integer> {
    Optional<Location> findByCodeIgnoreCase(String code);
}
