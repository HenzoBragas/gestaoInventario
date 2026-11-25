package com.gestaoInvetario.application.integration;

import com.gestaoInvetario.application.model.Marketplace;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Pedidos simulados, so para desenvolvimento (app.marketplace.simulation.enabled=true).
 * Quando ligado, o worker le daqui em vez de chamar a API do marketplace, permitindo testar
 * a associacao por SKU e a baixa sem anuncio nem conta real. Fica em memoria: some ao reiniciar.
 */
@Component
public class SimulatedOrderStore {

    private final boolean enabled;
    private final Map<String, ExternalOrder> orders = new ConcurrentHashMap<>();

    public SimulatedOrderStore(@Value("${app.marketplace.simulation.enabled:false}") boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void put(Marketplace marketplace, ExternalOrder order) {
        orders.put(key(marketplace, order.orderId()), order);
    }

    public Optional<ExternalOrder> find(Marketplace marketplace, String orderId) {
        return enabled ? Optional.ofNullable(orders.get(key(marketplace, orderId))) : Optional.empty();
    }

    private static String key(Marketplace marketplace, String orderId) {
        return marketplace.name() + ":" + orderId;
    }
}
