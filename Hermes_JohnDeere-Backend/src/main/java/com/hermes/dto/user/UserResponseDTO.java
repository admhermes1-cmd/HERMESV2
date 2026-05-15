package com.hermes.dto.user;

import com.hermes.entity.User;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO de saída completo para um único usuário.
 *
 * <p>Expõe todos os campos públicos, incluindo a {@code apiKey}, adequado para a tela
 * de detalhes/edição. O campo {@code password} nunca é exposto.</p>
 *
 * @param id        Identificador único do usuário.
 * @param name      Nome completo.
 * @param email     Endereço de e-mail (imutável após criação).
 * @param role      Papel no sistema: {@code ADMIN} ou {@code USER}.
 * @param apiKey    Chave de API gerada automaticamente no cadastro.
 * @param isActive  Indica se a conta está ativa.
 * @param createdAt Data e hora de criação do registro.
 * @param updatedAt Data e hora da última atualização.
 */
public record UserResponseDTO(
        UUID id,
        String name,
        String email,
        String role,
        String apiKey,
        boolean isActive,
        boolean mustChangePassword,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    /**
     * Constrói um {@link UserResponseDTO} a partir da entidade {@link User}.
     *
     * @param user entidade de domínio; não deve ser {@code null}.
     * @return DTO populado.
     */
    public static UserResponseDTO from(User user) {
        return new UserResponseDTO(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getApiKey(),
                user.isActive(),
                user.isMustChangePassword(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
