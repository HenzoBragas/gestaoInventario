package com.gestaoInvetario.application.model;

public enum MarketplaceOrderStatus {
    /** Notificacao recebida, aguardando o worker. */
    PENDING,
    /** Em processamento por um worker. */
    PROCESSING,
    /** Estoque baixado. Notificacoes seguintes do mesmo pedido sao ignoradas. */
    DONE,
    /** Falhou; sera tentado de novo em nextAttemptAt (ou manualmente, se esgotou as tentativas). */
    FAILED,
    /** Pedido nao pago ou cancelado: nada a baixar. Uma nova notificacao reabre o pedido. */
    IGNORED
}
