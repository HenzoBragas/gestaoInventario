package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, Integer> {

    long countByProduct_Id(Integer productId);
}
