package com.hermes.entity;

import com.hermes.entity.enums.ScheduledMessageStatus;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Controla o agendamento e as tentativas de entrega de uma {@link Notification}.
 *
 * <p>Um {@code ScheduledMessage} é criado automaticamente pelo serviço sempre que
 * {@link Notification#getScheduledAt()} não é {@code null}. Ele gerencia o ciclo de
 * retentativas com backoff exponencial até o limite de {@code maxAttempts} (padrão: 3).</p>
 *
 * <p><strong>Ciclo de vida:</strong></p>
 * <pre>
 * PENDING ──► PROCESSING ──► DONE
 *    │              │
 *    └──────────────► CANCELLED
 * </pre>
 *
 * <p><strong>Retentativas:</strong> após cada falha de envio, o scheduler incrementa
 * {@code attempts}, registra o erro em {@code error}, e calcula {@code nextAttemptAt}
 * com backoff exponencial simples: {@code scheduledAt + 2^attempts minutos}.
 * Ao atingir o limite, a notificação é marcada como {@link NotificationStatus#FAILED}.</p>
 *
 * <p><strong>Lombok:</strong> {@code @Getter}, {@code @Setter}, {@code @Builder},
 * {@code @NoArgsConstructor} e {@code @AllArgsConstructor} gerados em tempo de compilação.</p>
 */
@Entity
@Table(
    name = "scheduled_messages",
    indexes = {
        @Index(name = "idx_scheduled_status",       columnList = "status"),
        @Index(name = "idx_scheduled_at",           columnList = "scheduled_at"),
        @Index(name = "idx_scheduled_next_attempt", columnList = "next_attempt_at")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledMessage {

    // ─── Chave primária ───────────────────────────────────────────────────────

    /**
     * Identificador único do agendamento (UUIDv4).
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Relacionamento ───────────────────────────────────────────────────────

    /**
     * Notificação associada a este agendamento.
     * Relacionamento {@code @OneToOne}: cada notificação tem no máximo um agendamento.
     * Carregado de forma lazy para evitar joins desnecessários.
     */
    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "notification_id", nullable = false, unique = true, updatable = false)
    private Notification notification;

    // ─── Temporalidade ────────────────────────────────────────────────────────

    /**
     * Momento em que a notificação deve ser enviada pela primeira vez.
     * Definido na criação e não alterado — retentativas usam {@code nextAttemptAt}.
     */
    @Column(name = "scheduled_at", nullable = false, updatable = false)
    private LocalDateTime scheduledAt;

    // ─── Estado ───────────────────────────────────────────────────────────────

    /**
     * Estado atual do processamento deste agendamento.
     * Valor inicial: {@link ScheduledMessageStatus#PENDING}.
     *
     * @see ScheduledMessageStatus
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScheduledMessageStatus status = ScheduledMessageStatus.PENDING;

    // ─── Controle de retentativas ─────────────────────────────────────────────

    /**
     * Número de tentativas de envio realizadas até o momento.
     * Incrementado pelo scheduler a cada tentativa (bem-sucedida ou não).
     * Valor inicial: {@code 0}.
     */
    @Builder.Default
    @Column(nullable = false)
    private int attempts = 0;

    /**
     * Timestamp da última tentativa de envio executada pelo scheduler.
     * {@code null} enquanto nenhuma tentativa foi realizada.
     */
    @Column(name = "last_attempt_at")
    private LocalDateTime lastAttemptAt;

    /**
     * Timestamp calculado para a próxima tentativa após uma falha.
     * Determinado com backoff exponencial: {@code scheduledAt + 2^attempts minutos}.
     * {@code null} enquanto nenhuma falha ocorreu ou após o limite de tentativas.
     */
    @Column(name = "next_attempt_at")
    private LocalDateTime nextAttemptAt;

    // ─── Diagnóstico ──────────────────────────────────────────────────────────

    /**
     * Mensagem de erro da última tentativa falha.
     * Sobrescrita a cada nova tentativa; o histórico completo deve ser consultado nos logs.
     */
    @Column(columnDefinition = "TEXT")
    private String error;

    // ─── Auditoria ────────────────────────────────────────────────────────────

    /**
     * Timestamp de criação do agendamento. Imutável.
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // ─── Lifecycle callbacks ──────────────────────────────────────────────────

    /**
     * Popula {@code createdAt} na primeira persistência.
     */
    @PrePersist
    protected void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    // ─── Métodos de conveniência ──────────────────────────────────────────────

    /**
     * Verifica se este agendamento ainda pode ser retentado.
     *
     * <p>Retorna {@code true} apenas se:
     * <ul>
     *   <li>O número de tentativas ainda não atingiu o máximo configurado.</li>
     *   <li>O status não é um estado terminal ({@code DONE} ou {@code CANCELLED}).</li>
     * </ul>
     * </p>
     *
     * @param maxAttempts número máximo de tentativas permitidas (tipicamente 3)
     * @return {@code true} se uma nova tentativa pode ser realizada
     */
    public boolean canRetry(int maxAttempts) {
        return attempts < maxAttempts
            && status != ScheduledMessageStatus.DONE
            && status != ScheduledMessageStatus.CANCELLED;
    }
}