package com.hermes.entity;

import com.hermes.entity.enums.NotificationChannel;
import com.hermes.entity.enums.NotificationStatus;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Registro de uma solicitação de envio de mensagem no sistema HERMES.
 *
 * <p>Uma {@code Notification} representa uma requisição de envio: ela associa
 * um template (e opcionalmente uma versão específica) a um conjunto de destinatários,
 * preenchendo as variáveis do template com valores concretos.</p>
 *
 * <p><strong>Ciclo de vida:</strong></p>
 * <pre>
 * PENDING ──► SCHEDULED ──► SENT
 *    │                       │
 *    └──────────────────► FAILED
 * </pre>
 *
 * <p><strong>Agendamento:</strong> se {@code scheduledAt} não for {@code null},
 * o serviço cria automaticamente um {@link ScheduledMessage} associado e muda o
 * status para {@code SCHEDULED}.</p>
 *
 * <p><strong>Armazenamento JSON:</strong> os campos {@code recipients}, {@code variables}
 * e {@code attachments} são estruturas complexas persistidas como {@code jsonb} via
 * converters JPA customizados. Apenas metadados de anexos são armazenados — arquivos
 * binários não são persistidos no banco.</p>
 *
 * <p><strong>Lombok:</strong> {@code @Getter}, {@code @Setter}, {@code @Builder}
 * e {@code @NoArgsConstructor} gerados em tempo de compilação.</p>
 */
@Entity
@Table(
    name = "notifications",
    indexes = {
        @Index(name = "idx_notification_status",     columnList = "status"),
        @Index(name = "idx_notification_channel",    columnList = "channel"),
        @Index(name = "idx_notification_created_at", columnList = "created_at"),
        @Index(name = "idx_notification_template",   columnList = "template_id"),
        @Index(name = "idx_notification_scheduled",  columnList = "scheduled_at")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
// @AllArgsConstructor removido — conflito com @Builder.Default:
// o Lombok injeta campos sintéticos ($default$status, etc.) que quebram
// o construtor gerado pelo @AllArgsConstructor, causando falha silenciosa
// na geração de alguns métodos (getters incluídos).
public class Notification {

    // ─── Chave primária ───────────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Canal e estado ───────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationChannel channel;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationStatus status = NotificationStatus.PENDING;

    // ─── Referências ao template ──────────────────────────────────────────────

    @Column(name = "template_id", nullable = false, updatable = false)
    private UUID templateId;

    @Column(name = "template_version_id", updatable = false)
    private UUID templateVersionId;

    // ─── Destinatários ────────────────────────────────────────────────────────

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private RecipientsData recipients;

    // ─── Variáveis ────────────────────────────────────────────────────────────

    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> variables = new HashMap<>();

    // ─── Anexos ───────────────────────────────────────────────────────────────

    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<AttachmentMetadata> attachments = new ArrayList<>();

    // ─── Temporalidade ────────────────────────────────────────────────────────

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    // ─── Diagnóstico ──────────────────────────────────────────────────────────

    @Column(columnDefinition = "TEXT")
    private String error;

    // ─── Auditoria ────────────────────────────────────────────────────────────

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // ─── Lifecycle callbacks ──────────────────────────────────────────────────

    @PrePersist
    protected void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    public Notification(UUID id, NotificationChannel channel, NotificationStatus status,
                    UUID templateId, UUID templateVersionId, RecipientsData recipients,
                    Map<String, String> variables, List<AttachmentMetadata> attachments,
                    LocalDateTime scheduledAt, LocalDateTime sentAt, String error,
                    UUID createdBy, LocalDateTime createdAt) {
        this.id = id;
        this.channel = channel;
        this.status = status;
        this.templateId = templateId;
        this.templateVersionId = templateVersionId;
        this.recipients = recipients;
        this.variables = variables;
        this.attachments = attachments;
        this.scheduledAt = scheduledAt;
        this.sentAt = sentAt;
        this.error = error;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    // ─── Records internos ────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RecipientsData(
        List<String> to,
        List<String> cc,
        List<String> bcc
    ) {
        public RecipientsData {
            to  = to  != null ? to  : new ArrayList<>();
            cc  = cc  != null ? cc  : new ArrayList<>();
            bcc = bcc != null ? bcc : new ArrayList<>();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AttachmentMetadata(
        String name,
        long size
    ) {}
}
