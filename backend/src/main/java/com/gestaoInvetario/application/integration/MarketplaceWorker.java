package com.gestaoInvetario.application.integration;

import com.gestaoInvetario.application.integration.MarketplaceOrderService.OrderQueued;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Dois caminhos assincronos para o mesmo processamento:
 * 1. imediato: logo apos o commit do webhook, numa thread do pool "marketplace-";
 * 2. varredura periodica: novas tentativas com backoff e pedidos que ficaram para tras
 *    (fila cheia, servidor reiniciado no meio do processamento).
 */
@Component
public class MarketplaceWorker {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceWorker.class);

    private final MarketplaceOrderService service;

    public MarketplaceWorker(MarketplaceOrderService service) {
        this.service = service;
    }

    @Async(AsyncConfig.MARKETPLACE_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onQueued(OrderQueued event) {
        safeProcess(event.id());
    }

    @Scheduled(fixedDelayString = "${app.marketplace.worker.poll-interval-ms:30000}",
            initialDelayString = "${app.marketplace.worker.initial-delay-ms:15000}")
    public void processDue() {
        for (Long id : service.dueIds(50)) {
            safeProcess(id);
        }
    }

    private void safeProcess(Long id) {
        try {
            service.process(id);
        } catch (RuntimeException e) {
            log.error("Erro inesperado ao processar o pedido de marketplace {}", id, e);
        }
    }
}
