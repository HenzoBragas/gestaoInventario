package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.Marketplace;
import com.gestaoInvetario.application.model.MarketplaceOrder;
import com.gestaoInvetario.application.model.MarketplaceOrderStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MarketplaceOrderRepository extends JpaRepository<MarketplaceOrder, Long> {

    Optional<MarketplaceOrder> findByMarketplaceAndExternalOrderId(Marketplace marketplace, String externalOrderId);

    /** Usado pelo worker: enquanto grava, avisos novos do mesmo pedido esperam em vez de conflitar. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from MarketplaceOrder o where o.id = :id")
    Optional<MarketplaceOrder> findByIdForUpdate(@Param("id") Long id);

    /** Serializa avisos simultaneos do mesmo pedido (o marketplace costuma mandar varios em rajada). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from MarketplaceOrder o where o.marketplace = :marketplace and o.externalOrderId = :orderId")
    Optional<MarketplaceOrder> findForUpdate(@Param("marketplace") Marketplace marketplace,
                                             @Param("orderId") String externalOrderId);

    Page<MarketplaceOrder> findByStatus(MarketplaceOrderStatus status, Pageable pageable);

    /** Pedidos prontos para (re)processar, incluindo os presos em PROCESSING por um worker que caiu. */
    @Query("select o.id from MarketplaceOrder o "
            + "where (o.status in :due and o.nextAttemptAt <= :now) "
            + "or (o.status = :processing and o.lockedAt < :staleBefore) "
            + "order by o.id")
    List<Long> findDueIds(@Param("due") Collection<MarketplaceOrderStatus> due,
                          @Param("processing") MarketplaceOrderStatus processing,
                          @Param("now") Instant now,
                          @Param("staleBefore") Instant staleBefore,
                          Pageable pageable);
}
