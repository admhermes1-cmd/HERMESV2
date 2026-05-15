package com.hermes.entity.enums;

/**
 * Estado de processamento de um {@link ScheduledMessage}.
 *
 * <pre>
 * PENDING ──► PROCESSING ──► DONE
 *    │              │
 *    └──────────────► CANCELLED
 * </pre>
 */
public enum ScheduledMessageStatus {

    /** Aguardando o momento agendado para iniciar o processamento. */
    PENDING,

    /** O scheduler está ativamente tentando enviar a mensagem. */
    PROCESSING,

    /** Mensagem entregue com sucesso. Estado terminal. */
    DONE,

    /** Cancelada manualmente ou por política do sistema. Estado terminal. */
    CANCELLED,

    FAILED
}