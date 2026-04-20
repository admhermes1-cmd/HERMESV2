package com.hermes.entity.enums;

/**
 * Ciclo de vida de uma {@link Notification} no sistema HERMES.
 *
 * <pre>
 * PENDING ──► SCHEDULED ──► SENT
 *    │                       │
 *    └──────────────────► FAILED
 * </pre>
 */
public enum NotificationStatus {

    /** Notificação criada, aguardando processamento ou envio imediato. */
    PENDING,

    /** Notificação agendada para envio futuro; existe um {@link ScheduledMessage} associado. */
    SCHEDULED,

    /** Notificação entregue com sucesso ao canal de destino. */
    SENT,

    /** Falha definitiva no envio (esgotadas as tentativas ou erro irrecuperável). */
    FAILED
}