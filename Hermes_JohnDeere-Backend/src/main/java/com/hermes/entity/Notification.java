package com.hermes.entity;

import com.hermes.entity.enums.NotificationChannel;
import com.hermes.entity.enums.NotificationStatus;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hermes.entity.converter.AttachmentListConverter;
import com.hermes.entity.converter.MapConverter;
import com.hermes.entity.converter.RecipientsConverter;
import jakarta.persistence.*;
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
 * <p><strong>Lombok:</strong> {@code @Getter}, {@code @Setter}, {@code @Builder},
 * {@code @NoArgsConstructor} e {@code @AllArgsConstructor} gerados em tempo de compilação.</p>
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
@AllArgsConstructor
public class Notification {

    // ─── Chave primária ───────────────────────────────────────────────────────

    /**
     * Identificador único da notificação (UUIDv4).
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Canal e estado ───────────────────────────────────────────────────────

    /**
     * Canal pelo qual a mensagem será entregue.
     * Deve corresponder ao canal do template referenciado.
     *
     * @see NotificationChannel
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationChannel channel;

    /**
     * Estado atual da notificação no ciclo de vida do HERMES.
     * Valor inicial: {@link NotificationStatus#PENDING}.
     *
     * @see NotificationStatus
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationStatus status = NotificationStatus.PENDING;

    // ─── Referências ao template ──────────────────────────────────────────────

    /**
     * UUID do template utilizado nesta notificação.
     * Armazenado como referência simples para desacoplar os agregados.
     */
    @Column(name = "template_id", nullable = false, updatable = false)
    private UUID templateId;

    /**
     * UUID da versão específica do template a ser usada.
     * Se {@code null}, o serviço usará a versão mais recente ativa do template.
     */
    @Column(name = "template_version_id", updatable = false)
    private UUID templateVersionId;

    // ─── Destinatários ────────────────────────────────────────────────────────

    /**
     * Estrutura de destinatários: listas {@code to}, {@code cc} e {@code bcc}.
     * Persistida como JSON via {@link RecipientsConverter}.
     *
     * <p>Para SMS e WhatsApp, somente {@code to} é considerado.</p>
     */
    @Convert(converter = RecipientsConverter.class)
    @Column(columnDefinition = "jsonb", nullable = false)
    private RecipientsData recipients;

    // ─── Variáveis ────────────────────────────────────────────────────────────

    /**
     * Mapa de substituição das variáveis do template.
     * Chave: nome da variável (sem chaves); Valor: conteúdo a substituir.
     * Exemplo: {@code {"nome": "João", "empresa": "ACME"}}.
     * Persistido como JSON via {@link MapConverter}.
     */
    @Convert(converter = MapConverter.class)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> variables = new HashMap<>();

    // ─── Anexos ───────────────────────────────────────────────────────────────

    /**
     * Metadados dos arquivos anexados à notificação.
     * <strong>Apenas nome e tamanho são armazenados</strong> — o binário não é persistido.
     * Persistido como JSON via {@link AttachmentListConverter}.
     */
    @Convert(converter = AttachmentListConverter.class)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<AttachmentMetadata> attachments = new ArrayList<>();

    // ─── Temporalidade ────────────────────────────────────────────────────────

    /**
     * Momento agendado para envio. Se {@code null}, o envio é imediato.
     * Quando preenchido, o sistema cria um {@link ScheduledMessage} e define
     * o status como {@link NotificationStatus#SCHEDULED}.
     */
    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    /**
     * Momento em que a notificação foi efetivamente entregue ao canal.
     * Preenchido pelo serviço após confirmação de envio bem-sucedido.
     */
    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    // ─── Diagnóstico ──────────────────────────────────────────────────────────

    /**
     * Mensagem de erro detalhada em caso de falha no envio.
     * Inclui stack trace ou resposta do provider externo.
     */
    @Column(columnDefinition = "TEXT")
    private String error;

    // ─── Auditoria ────────────────────────────────────────────────────────────

    /**
     * UUID do usuário ou serviço que originou esta notificação.
     */
    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    /**
     * Timestamp de criação do registro. Imutável.
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

    // ─── Records internos (Java 17) ───────────────────────────────────────────

    /**
     * Estrutura imutável de destinatários de uma notificação.
     *
     * <p>Serializada como JSON no banco. A anotação {@code @JsonIgnoreProperties}
     * garante compatibilidade com possíveis campos extras em versões futuras do schema.</p>
     *
     * @param to  lista de destinatários principais (obrigatório, não vazio)
     * @param cc  destinatários em cópia (pode ser vazio)
     * @param bcc destinatários em cópia oculta (pode ser vazio)
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RecipientsData(
        List<String> to,
        List<String> cc,
        List<String> bcc
    ) {
        /** Construtor compacto que garante listas não-nulas. */
        public RecipientsData {
            to  = to  != null ? to  : new ArrayList<>();
            cc  = cc  != null ? cc  : new ArrayList<>();
            bcc = bcc != null ? bcc : new ArrayList<>();
        }
    }

    /**
     * Metadados de um arquivo anexo a uma notificação.
     *
     * <p>Apenas informações de identificação são persistidas — o arquivo binário
     * é transmitido diretamente ao provider de envio sem passar pelo banco de dados.</p>
     *
     * @param name nome original do arquivo incluindo extensão (ex.: {@code relatorio.pdf})
     * @param size tamanho do arquivo em bytes
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AttachmentMetadata(
        String name,
        long size
    ) {}
}