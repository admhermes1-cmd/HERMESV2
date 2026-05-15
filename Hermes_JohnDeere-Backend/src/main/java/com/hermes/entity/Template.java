package com.hermes.entity;

import com.hermes.entity.enums.NotificationChannel;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Template de mensagem reutilizável no sistema HERMES.
 *
 * <p>Um template define a estrutura e o canal de uma comunicação. Cada template
 * possui múltiplas {@link TemplateVersion versões}, permitindo evolução controlada
 * do conteúdo sem perda de histórico. A versão mais recente com {@code isActive = true}
 * é utilizada quando nenhuma versão específica é informada na notificação.</p>
 *
 * <p><strong>Regra de imutabilidade:</strong> o campo {@code channel} é definido
 * na criação e não pode ser alterado ({@code updatable = false}). Para mudar o canal,
 * crie um novo template.</p>
 *
 * <p><strong>Lombok:</strong> {@code @Getter}, {@code @Setter}, {@code @Builder},
 * {@code @NoArgsConstructor} e {@code @AllArgsConstructor} gerados em tempo de compilação.</p>
 */
@Entity
@Table(
    name = "templates",
    indexes = {
        @Index(name = "idx_template_channel",    columnList = "channel"),
        @Index(name = "idx_template_created_by", columnList = "created_by")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Template {

    // ─── Chave primária ───────────────────────────────────────────────────────

    /**
     * Identificador único do template (UUIDv4).
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Dados descritivos ────────────────────────────────────────────────────

    /**
     * Nome curto e identificável do template. Exibido na interface de seleção.
     * Exemplos: "Boas-vindas", "Redefinição de Senha", "Alerta de Fraude".
     */
    @Column(nullable = false)
    private String name;

    /**
     * Descrição opcional com mais contexto sobre o propósito e uso do template.
     * Limitada a 500 caracteres.
     */
    @Column(length = 500)
    private String description;

    // ─── Canal ────────────────────────────────────────────────────────────────

    /**
     * Canal de entrega do template.
     * <strong>Imutável</strong> após a criação — {@code updatable = false}.
     *
     * @see NotificationChannel
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private NotificationChannel channel;

    // ─── Versões ──────────────────────────────────────────────────────────────

    /**
     * Lista de versões deste template.
     *
     * <p>Carregada de forma lazy para evitar N+1 queries. O cascade {@code ALL}
     * garante que versões órfãs sejam removidas automaticamente.</p>
     */
    @OneToMany(
        mappedBy      = "template",
        cascade       = CascadeType.ALL,
        fetch         = FetchType.LAZY,
        orphanRemoval = true
    )
    @Builder.Default
    private List<TemplateVersion> versions = new ArrayList<>();

    // ─── Auditoria ────────────────────────────────────────────────────────────

    /**
     * UUID do usuário que criou o template. Armazenado como referência simples
     * (sem FK explícita) para evitar dependência cíclica entre os serviços.
     */
    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    /**
     * Timestamp de criação. Imutável após a primeira persistência.
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Timestamp da última modificação nos campos do template.
     * Atualizado automaticamente a cada alteração.
     */
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ─── Lifecycle callbacks ──────────────────────────────────────────────────

    /**
     * Popula {@code createdAt} e {@code updatedAt} na primeira inserção.
     */
    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    /**
     * Atualiza {@code updatedAt} a cada alteração.
     */
    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}