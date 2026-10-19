package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.Product;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends JpaRepository<Product, Integer>, JpaSpecificationExecutor<Product> {

    boolean existsByName(String name);

    boolean existsByCode(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Integer id);

    long countByCategory_Seq(Integer categorySeq);

    long countBySupplier_Id(Integer supplierId);

    long countByDefaultLocation_Id(Integer locationId);

    @Query("select p from Product p left join fetch p.category")
    java.util.List<Product> findAllWithCategory();

    /** Bloqueia a linha do produto ate o fim da transacao: serializa movimentacoes concorrentes. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Integer id);
}
