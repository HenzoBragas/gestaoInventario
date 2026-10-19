package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.StockMovement;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long>, JpaSpecificationExecutor<StockMovement> {

    Optional<StockMovement> findByRequestKey(String requestKey);

    long countByProduct_Id(Integer productId);

    boolean existsByFromLocation_IdOrToLocation_Id(Integer fromId, Integer toId);

    /** Movimentacoes a partir de uma data, com produto e localizacoes carregados (para agregacoes). */
    @Query("select m from StockMovement m join fetch m.product p left join fetch p.category "
            + "left join fetch m.fromLocation left join fetch m.toLocation "
            + "where m.createdAt >= :from order by m.createdAt asc")
    List<StockMovement> findSince(@Param("from") Instant from);

    @Query("select m from StockMovement m join fetch m.product "
            + "left join fetch m.fromLocation left join fetch m.toLocation order by m.createdAt desc, m.id desc")
    List<StockMovement> findRecent(Pageable pageable);
}
