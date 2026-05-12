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
 * <p><strong>Lombok:</strong> {@code @Getter}, {@code @Setter}, {@code @Builder}
 * e {@code @NoArgsConstructor} gerados em tempo de compilação.
 * {@code @AllArgsConstructor} é omitido intencionalmente — o uso de {@code @Builder.Default}
 * em campos booleanos é incompatível com construtores gerados pelo Lombok quando ambos coexistem,
 * causando falha silenciosa na geração de métodos (getters incluídos).
 * Métodos da interface {@link UserDetails} são implementados manualmente para clareza.</p>
 *
 * <p><strong>Convenção de campos booleanos:</strong> campos booleanos primitivos NÃO devem
 * ter prefixo {@code is} no nome — o Lombok geraria getters como {@code isIsActive()}.
 * Use nomes sem prefixo ({@code active}, {@code mustChangePassword}) para que o Lombok
 * gere corretamente {@code isActive()} e {@code isMustChangePassword()}.</p>
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
// @AllArgsConstructor removido — conflito com @Builder.Default:
// o Lombok injeta campos sintéticos ($default$active, $default$mustChangePassword)
// que quebram o construtor gerado e causam falha silenciosa na geração de getters.
public class User implements UserDetails {

    // ─── Chave primária ───────────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    // ─── Dados de identificação ───────────────────────────────────────────────

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    // ─── Controle de acesso ───────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private UserRole role;

    @Column(name = "api_key", unique = true, nullable = false, updatable = false, length = 32)
    private String apiKey;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    // ─── Auditoria ────────────────────────────────────────────────────────────

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder.Default
    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = true;

    // ─── Lifecycle callbacks ──────────────────────────────────────────────────

    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.apiKey == null) {
            this.apiKey = UUID.randomUUID().toString().replace("-", "");
        }
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Construtor all-args manual — necessário para Hibernate/JPA.
    // @AllArgsConstructor não pode coexistir com @Builder.Default.
    public User(UUID id, String name, String email, String password,
            UserRole role, String apiKey, boolean active,
            LocalDateTime createdAt, LocalDateTime updatedAt,
            boolean mustChangePassword) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password = password;
        this.role = role;
        this.apiKey = apiKey;
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.mustChangePassword = mustChangePassword;
    }

    // ─── UserDetails ─────────────────────────────────────────────────────────

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    /**
     * Retorna a senha (hash bcrypt). Override explícito necessário: o compilador
     * não enxerga o getter gerado pelo Lombok como implementação do contrato
     * {@link UserDetails#getPassword()} sem a anotação {@code @Override}.
     */
    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
