package com.gestaoInvetario.application.integration;

import com.gestaoInvetario.application.dtos.MarketplaceDtos.MarketplaceOrderResponse;
import com.gestaoInvetario.application.dtos.PageResponse;
import com.gestaoInvetario.application.exception.ApiException;
import com.gestaoInvetario.application.integration.ExternalOrder.Item;
import com.gestaoInvetario.application.model.Marketplace;
import com.gestaoInvetario.application.model.MarketplaceOrder;
import com.gestaoInvetario.application.model.MarketplaceOrderStatus;
import com.gestaoInvetario.application.model.Product;
import com.gestaoInvetario.application.repositories.MarketplaceOrderRepository;
import com.gestaoInvetario.application.repositories.ProductRepository;
import com.gestaoInvetario.application.service.StockService;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Ciclo de vida de um pedido de marketplace:
 * webhook -> {@link #enqueue} (PENDING) -> worker assincrono -> {@link #process}:
 * busca o pedido na API; se pago, baixa o estoque e marca DONE na MESMA transacao (por isso uma
 * notificacao repetida nunca baixa duas vezes). Falhas ficam FAILED com nova tentativa agendada.
 */
@Service
public class MarketplaceOrderService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceOrderService.class);
    private static final Pattern ORDER_ID = Pattern.compile("[A-Za-z0-9_-]{1,32}");
    private static final List<MarketplaceOrderStatus> DUE = List.of(MarketplaceOrderStatus.PENDING, MarketplaceOrderStatus.FAILED);

    /** Publicado ao enfileirar; o worker processa depois do commit. */
    public record OrderQueued(Long id) {
    }

    private final MarketplaceOrderRepository orders;
    private final ProductRepository products;
    private final StockService stock;
    private final MercadoLivreClient mercadoLivre;
    private final ShopeeClient shopee;
    private final SimulatedOrderStore simulation;
    private final MarketplaceProperties.Worker worker;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;

    public MarketplaceOrderService(MarketplaceOrderRepository orders, ProductRepository products, StockService stock,
                                   MercadoLivreClient mercadoLivre, ShopeeClient shopee, SimulatedOrderStore simulation,
                                   MarketplaceProperties properties, ApplicationEventPublisher events,
                                   PlatformTransactionManager txManager) {
        this.orders = orders;
        this.products = products;
        this.stock = stock;
        this.mercadoLivre = mercadoLivre;
        this.shopee = shopee;
        this.simulation = simulation;
        this.worker = properties.worker();
        this.events = events;
        this.tx = new TransactionTemplate(txManager);
    }

    // ------------------------------------------------------------------ entrada (webhook)

    /**
     * Registra (ou reabre) o pedido para processamento. Rapido: nenhuma chamada externa aqui.
     * Se o worker alterar o mesmo pedido no mesmo instante (conflito de versao) ou dois avisos do
     * mesmo pedido chegarem juntos (insercao duplicada), repete com o estado atualizado.
     */
    public void enqueue(Marketplace marketplace, String externalOrderId) {
        String orderId = externalOrderId == null ? "" : externalOrderId.trim();
        if (!ORDER_ID.matcher(orderId).matches()) {
            throw ApiException.unprocessable("INVALID_ORDER_ID", "Identificador de pedido inválido.");
        }
        for (int attempt = 1; ; attempt++) {
            try {
                tx.executeWithoutResult(status -> enqueueOnce(marketplace, orderId));
                return;
            } catch (OptimisticLockingFailureException | DataIntegrityViolationException e) {
                if (attempt >= 5) {
                    throw e;
                }
            }
        }
    }

    private void enqueueOnce(Marketplace marketplace, String orderId) {
        Instant now = Instant.now();
        MarketplaceOrder order = orders.findForUpdate(marketplace, orderId).orElse(null);
        if (order == null) {
            order = new MarketplaceOrder();
            order.setMarketplace(marketplace);
            order.setExternalOrderId(orderId);
            order.setReceivedAt(now);
            order.setStatus(MarketplaceOrderStatus.PENDING);
            order.setNextAttemptAt(now);
        } else {
            // Avisos que nao mudam nada nao gravam: menos disputa com o worker pela mesma linha.
            switch (order.getStatus()) {
                case DONE, PENDING -> {
                    // DONE: mudancas posteriores (envio, entrega...) nao alteram o estoque.
                    // PENDING: ja esta na fila; o worker vai ler o estado mais recente do pedido.
                    return;
                }
                case PROCESSING -> {
                    // O worker esta lendo o pedido agora e pode ter visto o status anterior: reprocessa ao terminar.
                    if (order.isRequeue()) {
                        return;
                    }
                    order.setRequeue(true);
                }
                default -> {
                    order.setStatus(MarketplaceOrderStatus.PENDING);
                    order.setAttempts(0);
                    order.setNextAttemptAt(now);
                }
            }
        }
        order.setLastNotificationAt(now);
        order = orders.saveAndFlush(order);
        if (order.getStatus() == MarketplaceOrderStatus.PENDING) {
            events.publishEvent(new OrderQueued(order.getId()));
        }
    }

    // ------------------------------------------------------------------ processamento (worker)

    public List<Long> dueIds(int limit) {
        Instant now = Instant.now();
        return orders.findDueIds(DUE, MarketplaceOrderStatus.PROCESSING, now, now.minus(worker.staleAfter()),
                PageRequest.of(0, limit));
    }

    public void process(Long id) {
        MarketplaceOrder order = claim(id);
        if (order == null) {
            return; // outro worker pegou, ou ainda nao esta na hora
        }
        try {
            ExternalOrder external = fetch(order.getMarketplace(), order.getExternalOrderId());
            switch (external.state()) {
                case PAID -> {
                    tx.executeWithoutResult(status -> applySale(id, external));
                    log.info("{} pedido {}: estoque baixado.", order.getMarketplace().label(), order.getExternalOrderId());
                }
                case AWAITING_PAYMENT -> finish(id, external.rawStatus(), "Aguardando pagamento.");
                case CANCELLED -> finish(id, external.rawStatus(), "Pedido cancelado no marketplace; nada a baixar.");
            }
        } catch (RuntimeException e) {
            log.warn("{} pedido {}: falha na tentativa {}: {}", order.getMarketplace().label(),
                    order.getExternalOrderId(), order.getAttempts(), describe(e));
            fail(id, e);
        }
    }

    private ExternalOrder fetch(Marketplace marketplace, String orderId) {
        var simulated = simulation.find(marketplace, orderId);
        if (simulated.isPresent()) {
            return simulated.get();
        }
        return switch (marketplace) {
            case MERCADO_LIVRE -> mercadoLivre.fetchOrder(orderId);
            case SHOPEE -> shopee.fetchOrder(orderId);
        };
    }

    /** Marca PROCESSING se o pedido estiver disponivel. O @Version garante que so um worker vence. */
    private MarketplaceOrder claim(Long id) {
        try {
            return tx.execute(status -> {
                MarketplaceOrder order = orders.findByIdForUpdate(id).orElse(null);
                Instant now = Instant.now();
                if (order == null || !isDue(order, now)) {
                    return null;
                }
                order.setStatus(MarketplaceOrderStatus.PROCESSING);
                order.setLockedAt(now);
                order.setAttempts(order.getAttempts() + 1);
                order.setRequeue(false);
                return orders.saveAndFlush(order);
            });
        } catch (OptimisticLockingFailureException e) {
            return null;
        }
    }

    private boolean isDue(MarketplaceOrder order, Instant now) {
        return switch (order.getStatus()) {
            case PENDING, FAILED -> order.getNextAttemptAt() != null && !order.getNextAttemptAt().isAfter(now);
            case PROCESSING -> order.getLockedAt() == null || order.getLockedAt().isBefore(now.minus(worker.staleAfter()));
            case DONE, IGNORED -> false;
        };
    }

    /** Roda em transacao: baixa de estoque e status DONE sao confirmados juntos ou nenhum dos dois. */
    private void applySale(Long id, ExternalOrder external) {
        MarketplaceOrder order = orders.findByIdForUpdate(id).orElseThrow();
        if (order.getStatus() != MarketplaceOrderStatus.PROCESSING) {
            return; // outro worker assumiu o pedido
        }

        Map<String, Integer> bySku = new LinkedHashMap<>();
        List<String> problems = new ArrayList<>();
        for (Item item : external.items()) {
            if (item.sku() == null) {
                problems.add("\"" + item.title() + "\" (anúncio sem SKU)");
            } else if (item.quantity() > 0) {
                bySku.merge(item.sku(), item.quantity(), Integer::sum);
            }
        }
        Map<Integer, Integer> byProduct = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : bySku.entrySet()) {
            Product product = products.findFirstByCodeIgnoreCase(entry.getKey()).orElse(null);
            if (product == null) {
                problems.add("SKU " + entry.getKey() + " (sem produto com esse código)");
            } else {
                byProduct.merge(product.getId(), entry.getValue(), Integer::sum);
            }
        }
        if (!problems.isEmpty()) {
            throw new MarketplaceException("Itens não associados a produtos: " + String.join(", ", problems)
                    + ". O SKU do anúncio deve ser igual ao código do produto.");
        }
        if (byProduct.isEmpty()) {
            throw new MarketplaceException("Pedido sem itens.");
        }

        stock.registerMarketplaceSale(order.getMarketplace(), order.getExternalOrderId(), byProduct);

        Instant now = Instant.now();
        order.setStatus(MarketplaceOrderStatus.DONE);
        order.setExternalStatus(truncate(external.rawStatus(), 40));
        order.setSummary(truncate(bySku.entrySet().stream()
                .map(e -> e.getValue() + "x " + e.getKey()).collect(Collectors.joining("; ")), 500));
        order.setLastError(null);
        order.setLockedAt(null);
        order.setNextAttemptAt(null);
        order.setRequeue(false);
        order.setProcessedAt(now);
        orders.saveAndFlush(order); // conflito de versao desfaz tambem a baixa
    }

    private void finish(Long id, String externalStatus, String note) {
        update(id, order -> {
            order.setExternalStatus(truncate(externalStatus, 40));
            order.setSummary(note);
            order.setLastError(null);
            if (!requeueIfNotified(order)) {
                order.setStatus(MarketplaceOrderStatus.IGNORED);
                order.setNextAttemptAt(null);
                order.setProcessedAt(Instant.now());
            }
        });
    }

    private void fail(Long id, RuntimeException error) {
        update(id, order -> {
            order.setLastError(truncate(describe(error), 1000));
            if (!requeueIfNotified(order)) {
                order.setStatus(MarketplaceOrderStatus.FAILED);
                order.setNextAttemptAt(order.getAttempts() >= worker.maxAttempts()
                        ? null // esgotou: so reprocessa manualmente ou com nova notificacao
                        : Instant.now().plus(backoff(order.getAttempts())));
            }
        });
    }

    private boolean requeueIfNotified(MarketplaceOrder order) {
        if (!order.isRequeue()) {
            return false;
        }
        order.setStatus(MarketplaceOrderStatus.PENDING);
        order.setNextAttemptAt(Instant.now());
        order.setRequeue(false);
        events.publishEvent(new OrderQueued(order.getId()));
        return true;
    }

    /** Atualiza um pedido em PROCESSING, repetindo se o webhook alterou a linha ao mesmo tempo. */
    private void update(Long id, Consumer<MarketplaceOrder> change) {
        for (int attempt = 1; ; attempt++) {
            try {
                tx.executeWithoutResult(status -> orders.findByIdForUpdate(id)
                        .filter(order -> order.getStatus() == MarketplaceOrderStatus.PROCESSING)
                        .ifPresent(order -> {
                            order.setLockedAt(null);
                            change.accept(order);
                            orders.saveAndFlush(order);
                        }));
                return;
            } catch (OptimisticLockingFailureException e) {
                if (attempt >= 3) {
                    throw e; // fica PROCESSING e e retomado apos staleAfter
                }
            }
        }
    }

    Duration backoff(int attempts) {
        Duration delay = worker.baseBackoff().multipliedBy(1L << Math.min(Math.max(attempts - 1, 0), 20));
        return delay.compareTo(worker.maxBackoff()) > 0 ? worker.maxBackoff() : delay;
    }

    // ------------------------------------------------------------------ consulta e reprocessamento manual

    @Transactional(readOnly = true)
    public PageResponse<MarketplaceOrderResponse> search(MarketplaceOrderStatus status, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "receivedAt", "id"));
        var result = status == null ? orders.findAll(pageable) : orders.findByStatus(status, pageable);
        return PageResponse.of(result, MarketplaceOrderService::toResponse);
    }

    @Transactional
    public MarketplaceOrderResponse retry(Long id) {
        MarketplaceOrder order = orders.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("Pedido"));
        if (order.getStatus() == MarketplaceOrderStatus.DONE) {
            throw ApiException.conflict("ALREADY_DONE", "O estoque deste pedido já foi baixado.", null);
        }
        if (order.getStatus() == MarketplaceOrderStatus.PROCESSING) {
            throw ApiException.conflict("IN_PROGRESS", "O pedido está sendo processado agora.", null);
        }
        order.setStatus(MarketplaceOrderStatus.PENDING);
        order.setAttempts(0);
        order.setNextAttemptAt(Instant.now());
        events.publishEvent(new OrderQueued(order.getId()));
        return toResponse(orders.save(order));
    }

    static MarketplaceOrderResponse toResponse(MarketplaceOrder o) {
        return new MarketplaceOrderResponse(o.getId(), o.getMarketplace(), o.getMarketplace().label(),
                o.getExternalOrderId(), o.getExternalStatus(), o.getStatus(), o.getAttempts(), o.getLastError(),
                o.getSummary(), o.getReceivedAt(), o.getLastNotificationAt(), o.getNextAttemptAt(), o.getProcessedAt());
    }

    private static String describe(Throwable e) {
        if (e instanceof ApiException || e instanceof MarketplaceException) {
            return e.getMessage();
        }
        return e.getClass().getSimpleName() + ": " + e.getMessage();
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
