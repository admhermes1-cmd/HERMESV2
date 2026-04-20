package com.hermes.entity;

import com.hermes.entity.enums.UserRole;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Representa um usuário autenticado no sistema HERMES.
 *
 * <p>Implementa {@link UserDetails} para integração direta com o Spring Security,
 * permitindo que a entidade seja usada como principal de autenticação sem adaptadores adicionais.</p>
 *
 * <p><strong>Autenticação:</strong> suporta dois mecanismos:</p>
 * <ul>
 *   <li><em>JWT/sessão</em> — via {@code email} + {@code password} (hash bcrypt).</li>
 *   <li><em>API Key</em> — via header HTTP, usando o campo {@code apiKey} gerado automaticamente.</li>
 * </ul>
 *
 * <p><strong>Lombok:</strong> {@code @Getter}, {@code @Setter}, {@code @Builder},
 * {@code @NoArgsConstructor} e {@code @AllArgsConstructor} são gerados em tempo de compilação.
 * Métodos da interface {@link UserDetails} são implementados manualmente para clareza.</p>
 */
@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_user_email",   columnList = "email",   unique = true),
        @Index(name = "idx_user_api_key", columnList = "api_key", unique = true)
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User implements UserDetails {

    // ─── Chave primária ───────────────────────────────────────────────────────

    /**
     * Identificador único do usuário (UUIDv4).
     * Gerado automaticamente na primeira persistência.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Dados de identificação ───────────────────────────────────────────────

    /**
     * Nome completo do usuário, exibido na interface e em logs de auditoria.
     */
    @Column(nullable = false)
    private String name;

    /**
     * Endereço de e-mail do usuário. Único no sistema; usado como login principal.
     */
    @Column(nullable = false, unique = true)
    private String email;

    /**
     * Senha do usuário armazenada como hash bcrypt.
     * <strong>Nunca</strong> armazenar texto plano.
     */
    @Column(nullable = false)
    private String password;

    // ─── Controle de acesso ───────────────────────────────────────────────────

    /**
     * Papel do usuário no sistema. Determina as permissões concedidas pelo Spring Security.
     *
     * @see UserRole
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private UserRole role;

    /**
     * Chave de API para autenticação programática (integração máquina-a-máquina).
     * Gerada automaticamente no {@link #prePersist()} como UUID sem hífens (32 chars).
     * Nunca deve ser alterada externamente — use o endpoint de regeneração.
     */
    @Column(name = "api_key", unique = true, nullable = false, updatable = false, length = 32)
    private String apiKey;

    /**
     * Indica se a conta está ativa. Contas inativas não conseguem autenticar.
     * Valor padrão: {@code true}.
     */
    @Builder.Default
    @Column(nullable = false)
    private boolean isActive = true;

    // ─── Auditoria ────────────────────────────────────────────────────────────

    /**
     * Timestamp de criação do registro. Imutável após a primeira persistência.
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Timestamp da última atualização do registro.
     */
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ─── Lifecycle callbacks ──────────────────────────────────────────────────

    /**
     * Popula campos automáticos antes da primeira inserção:
     * <ul>
     *   <li>{@code createdAt} e {@code updatedAt} com o instante atual.</li>
     *   <li>{@code apiKey} com UUID sem hífens, caso ainda não tenha sido definido.</li>
     * </ul>
     */
    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.apiKey == null) {
            this.apiKey = UUID.randomUUID().toString().replace("-", "");
        }
    }

    /**
     * Atualiza {@code updatedAt} a cada alteração na entidade.
     */
    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ─── UserDetails ─────────────────────────────────────────────────────────

    /**
     * Retorna a autoridade do usuário com o prefixo {@code ROLE_} exigido pelo Spring Security.
     * Ex.: {@code UserRole.ADMIN} → {@code ROLE_ADMIN}.
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    /**
     * Retorna o e-mail como identificador principal para o Spring Security.
     */
    @Override
    public String getUsername() {
        return email;
    }

    /** {@inheritDoc} — Contas não expiram nesta versão do sistema. */
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    /** {@inheritDoc} — Contas não são bloqueadas por tentativas falhas nesta versão. */
    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    /** {@inheritDoc} — Credenciais não expiram nesta versão do sistema. */
    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    /** {@inheritDoc} — Delegado ao campo {@link #isActive}. */
    @Override
    public boolean isEnabled() {
        return isActive;
    }
}