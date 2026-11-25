package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.Marketplace;
import com.gestaoInvetario.application.model.MarketplaceToken;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MarketplaceTokenRepository extends JpaRepository<MarketplaceToken, Marketplace> {

    /** Bloqueia a linha: so um worker renova o token por vez (o refresh token e de uso unico). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from MarketplaceToken t where t.marketplace = :marketplace")
    Optional<MarketplaceToken> findForUpdate(@Param("marketplace") Marketplace marketplace);
}
