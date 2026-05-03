package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository  extends JpaRepository<Product, Integer> {
    boolean existsByName(String name);

    boolean existsByCode(String code);
    
    long countByCategory_Seq(Integer categorySeq);
}


