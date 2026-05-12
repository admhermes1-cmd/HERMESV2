package com.hermes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Versão imutável de um {@link Template}.
 *
 * <p>Cada versão representa um snapshot do conteúdo do template em um dado momento.
 * Novas versões são criadas quando o conteúdo precisa ser atualizado, preservando
 * o histórico completo e garantindo rastreabilidade das mensagens enviadas.</p>
 *
 * <p><strong>Versionamento:</strong> {@code versionNumber} é sequencial por template
 * (1, 2, 3...) e é controlado pela camada de serviço. A constraint única
 * {@code (template_id, version_number)} garante integridade no banco.</p>
 *
 * <p><strong>Variáveis:</strong> o campo {@code variables} armazena as lacunas detectadas
 * no corpo do template no formato {@code {{nomeDaVariavel}}}. A detecção é feita pelo serviço
 * na criação/edição; aqui apenas persiste o resultado como JSON.</p>
 *
 * <p><strong>Lombok:</strong> {@code @Getter}, {@code @Setter} e {@code @Builder}
 * gerados em tempo de compilação. {@code @AllArgsConstructor} é omitido
 * intencionalmente — o uso de {@code @Builder.Default} em campos booleanos/coleções
 * é incompatível com construtores gerados pelo Lombok quando ambos coexistem.</p>
 *
 * <p><strong>Convenção de campos booleanos:</strong> campos booleanos primitivos NÃO devem
 * ter prefixo {@code is} no nome — o Lombok geraria getters como {@code isIsActive()}.
 * Use {@code active} para que o Lombok gere corretamente {@code isActive()}.</p>
 */
@Entity
@Table(
    name = "template_versions",
    indexes = {
        @Index(name = "idx_version_template",   columnList = "template_id"),
        @Index(name = "idx_version_is_active",  columnList = "is_active")
    },
    uniqueConstraints = {
        @UniqueConstraint(
            name        = "uq_template_version_number",
            columnNames = {"template_id", "version_number"}
        )
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
public class TemplateVersion {

    // ─── Chave primária ───────────────────────────────────────────────────────

    /**
     * Identificador único da versão (UUIDv4).
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Relacionamento com Template ──────────────────────────────────────────

    /**
     * Template ao qual esta versão pertence.
     * Carregado de forma lazy; nunca pode ser nulo.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private Template template;

    // ─── Metadados da versão ──────────────────────────────────────────────────

    /**
     * Número sequencial desta versão dentro do template pai.
     * Gerado e controlado pela camada de serviço (1-based).
     */
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    // ─── Conteúdo ─────────────────────────────────────────────────────────────

    /**
     * Assunto da mensagem — obrigatório para o canal EMAIL,
     * ignorado/nulo para SMS e WhatsApp.
     */
    @Column
    private String subject;

    /**
     * Corpo da mensagem. Pode conter HTML para e-mail ou texto plano para SMS/WhatsApp.
     * Armazenado como {@code TEXT} para suportar conteúdos extensos sem limitação de 255 chars.
     * Lacunas de variável no formato {@code {{nomeDaVariavel}}}.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    /**
     * Lista de nomes de variáveis detectadas no {@code body}.
     * Exemplo: {@code body = "Olá {{nome}}, sua senha é {{senha}}"} →
     * {@code variables = ["nome", "senha"]}.
     *
     * <p>Persistida como JSON array em {@code jsonb}.</p>
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> variables = new ArrayList<>();

    // ─── Estado ───────────────────────────────────────────────────────────────

    /**
     * Indica se esta versão está ativa e disponível para uso em novas notificações.
     *
     * <p>Nome do campo: {@code active} (sem prefixo {@code is}) para que o Lombok
     * gere corretamente {@code isActive()} — evita o getter duplo {@code isIsActive()}.</p>
     */
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    // ─── Auditoria ────────────────────────────────────────────────────────────

    /**
     * Timestamp de criação da versão. Imutável — versões nunca são editadas,
     * apenas novas versões são criadas.
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
}
