package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.StockBalance;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockBalanceRepository extends JpaRepository<StockBalance, Long> {

    Optional<StockBalance> findByProduct_IdAndLocation_Id(Integer productId, Integer locationId);

    @Query("select b from StockBalance b join fetch b.location where b.product.id = :productId order by b.location.code")
    List<StockBalance> findByProductId(@Param("productId") Integer productId);

    @Query("select b from StockBalance b join fetch b.location where b.product.id in :productIds and b.quantity <> 0")
    List<StockBalance> findNonZeroByProductIds(@Param("productIds") Collection<Integer> productIds);

    @Query("select b from StockBalance b join fetch b.product p left join fetch p.category "
            + "where b.location.id = :locationId and b.quantity <> 0 order by p.name")
    List<StockBalance> findNonZeroByLocationId(@Param("locationId") Integer locationId);

    @Query("select coalesce(sum(b.quantity), 0) from StockBalance b where b.location.id = :locationId")
    long sumQuantityByLocation(@Param("locationId") Integer locationId);

    @Query("select count(b) from StockBalance b where b.location.id = :locationId and b.quantity <> 0")
    long countProductsByLocation(@Param("locationId") Integer locationId);
}
