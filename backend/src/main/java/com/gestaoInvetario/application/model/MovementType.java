package com.gestaoInvetario.application.model;

public enum MovementType {
    /** Entrada de mercadoria em uma localizacao. */
    IN,
    /** Saida de mercadoria de uma localizacao. */
    OUT,
    /** Ajuste para o saldo contado em uma localizacao (exige justificativa). */
    ADJUSTMENT,
    /** Transferencia entre localizacoes (nao altera o saldo total). */
    TRANSFER
}
