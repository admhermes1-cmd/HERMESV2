package com.hermes.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Representa uma célula organizacional no sistema HERMES.
 *
 * <p>Uma célula agrupa usuários ({@link User}) sob a liderança de um gestor,
 * que deve ter obrigatoriamente o papel {@code GESTOR}. É a unidade estrutural
 * básica para organização de equipes dentro da plataforma.</p>
 *
 * <p><strong>Regras de negócio:</strong></p>
 * <ul>
 *   <li>O nome da célula deve ser único no sistema.</li>
 *   <li>O gestor deve ter {@code role = GESTOR}; validado no {@code CelulaService}.</li>
 *   <li>Ao excluir uma célula, o campo {@code celula} dos usuários vinculados é
 *       zerado via {@code orphanRemoval = false} e {@code nullable = true} em {@code User}.</li>
 * </ul>
 */
@Entity
@Table(
    name = "celulas",
    indexes = {
        @Index(name = "idx_celula_nome", columnList = "nome", unique = true)
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Celula {

    // ─── Chave primária ───────────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Dados da célula ──────────────────────────────────────────────────────

    /**
     * Nome identificador da célula (ex: "C1", "C2").
     * Deve ser único no sistema.
     */
    @Column(nullable = false, unique = true, length = 100)
    private String nome;

    // ─── Relacionamentos ──────────────────────────────────────────────────────

    /**
     * Gestor responsável pela célula.
     * Deve ter {@code role = GESTOR}; validado no service.
     * Carregamento EAGER justificado: gestor é exibido em todas as listagens de célula.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "gestor_id", nullable = true)
    private User gestor;

    /**
     * Lista de usuários vinculados a esta célula.
     * {@code mappedBy} aponta para o campo {@code celula} em {@link User}.
     * Carregamento LAZY — só materializado quando necessário (ex: endpoint de detalhe).
     */
    @OneToMany(mappedBy = "celula", fetch = FetchType.LAZY)
    @Builder.Default
    private List<User> usuarios = new ArrayList<>();

    // ─── Auditoria ────────────────────────────────────────────────────────────

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ─── Lifecycle callbacks ──────────────────────────────────────────────────

    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}