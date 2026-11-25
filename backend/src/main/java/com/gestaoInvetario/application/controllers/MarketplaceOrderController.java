package com.gestaoInvetario.application.controllers;

import com.gestaoInvetario.application.dtos.MarketplaceDtos.MarketplaceOrderResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.integration.MarketplaceOrderService;
import com.gestaoInvetario.application.model.MarketplaceOrderStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Acompanhamento dos pedidos recebidos dos marketplaces (Gerente/Administrador). */
@RestController
@RequestMapping("/integrations/orders")
public class MarketplaceOrderController {

    private final MarketplaceOrderService service;

    public MarketplaceOrderController(MarketplaceOrderService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<MarketplaceOrderResponse> search(
            @RequestParam(required = false) MarketplaceOrderStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return service.search(status, page, size);
    }

    /** Reprocessa um pedido com falha (ex.: depois de corrigir o SKU do produto ou dar entrada no estoque). */
    @PostMapping("/{id}/retry")
    public MarketplaceOrderResponse retry(@PathVariable Long id) {
        return service.retry(id);
    }
}
