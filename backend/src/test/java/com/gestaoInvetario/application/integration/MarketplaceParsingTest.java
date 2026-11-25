package com.gestaoInvetario.application.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gestaoInvetario.application.integration.ExternalOrder.State;
import org.junit.jupiter.api.Test;

/** Conversao das respostas reais (formato documentado) das APIs para o pedido normalizado. */
class MarketplaceParsingTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void parsesMercadoLivreOrder() throws Exception {
        var body = mapper.readTree("""
                {"id": 2000001234, "status": "paid", "seller": {"id": 555},
                 "order_items": [
                   {"item": {"id": "MLB1", "title": "Cabo HDMI", "seller_sku": "CAB-001"}, "quantity": 2},
                   {"item": {"id": "MLB2", "title": "Mouse", "seller_sku": null, "seller_custom_field": "MOU-010"}, "quantity": 1},
                   {"item": {"id": "MLB3", "title": "Sem SKU"}, "quantity": 1}
                 ]}""");

        ExternalOrder order = MercadoLivreClient.parseOrder("2000001234", body);

        assertThat(order.state()).isEqualTo(State.PAID);
        assertThat(order.items()).extracting(ExternalOrder.Item::sku).containsExactly("CAB-001", "MOU-010", null);
        assertThat(order.items()).extracting(ExternalOrder.Item::quantity).containsExactly(2, 1, 1);
    }

    @Test
    void mapsMercadoLivreStatuses() throws Exception {
        assertThat(MercadoLivreClient.parseOrder("1", mapper.readTree("{\"status\":\"payment_required\"}")).state())
                .isEqualTo(State.AWAITING_PAYMENT);
        assertThat(MercadoLivreClient.parseOrder("1", mapper.readTree("{\"status\":\"cancelled\"}")).state())
                .isEqualTo(State.CANCELLED);
    }

    @Test
    void parsesShopeeOrderPreferringModelSku() throws Exception {
        var order = mapper.readTree("""
                {"order_sn": "241124ABC", "order_status": "READY_TO_SHIP",
                 "item_list": [
                   {"item_name": "Camiseta", "item_sku": "CAM", "model_sku": "CAM-P", "model_quantity_purchased": 3},
                   {"item_name": "Caneca", "item_sku": "CAN-01", "model_sku": "", "model_quantity_purchased": 1}
                 ]}""");

        ExternalOrder parsed = ShopeeClient.parseOrder("241124ABC", order);

        assertThat(parsed.state()).isEqualTo(State.PAID);
        assertThat(parsed.items()).extracting(ExternalOrder.Item::sku).containsExactly("CAM-P", "CAN-01");
        assertThat(ShopeeClient.parseOrder("x", mapper.readTree("{\"order_status\":\"UNPAID\"}")).state())
                .isEqualTo(State.AWAITING_PAYMENT);
        assertThat(ShopeeClient.parseOrder("x", mapper.readTree("{\"order_status\":\"IN_CANCEL\"}")).state())
                .isEqualTo(State.CANCELLED);
    }
}
