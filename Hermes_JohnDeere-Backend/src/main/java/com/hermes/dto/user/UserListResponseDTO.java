package com.hermes.dto.user;

import com.hermes.entity.User;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO de saída resumido para listagem paginada de usuários.
 *
 * <p>Omite a {@code apiKey} por questões de segurança — essa informação só é
 * exibida na tela de detalhes/edição individual.</p>
 *
 * @param id        Identificador único do usuário.
 * @param name      Nome completo.
 * @param email     Endereço de e-mail.
 * @param role      Papel no sistema: {@code ADMIN}, {@code GESTOR} ou {@code USER}.
 * @param isActive  Indica se a conta está ativa.
 * @param matricula Matrícula única auto-incremental gerada pelo backend.
 * @param celula    Nome da célula à qual o usuário pertence (pode ser {@code null}).
 * @param createdAt Data e hora de criação do registro.
 */
public record UserListResponseDTO(
        UUID id,
        String name,
        String email,
        String role,
        boolean isActive,
        Integer matricula,
        String celula,
        LocalDateTime createdAt
) {

    /**
     * Constrói um {@link UserListResponseDTO} a partir da entidade {@link User}.
     *
     * @param user entidade de domínio; não deve ser {@code null}.
     * @return DTO resumido populado.
     */
    public static UserListResponseDTO from(User user) {
        String celulaNome = user.getCelula() != null ? user.getCelula().getNome() : null;

        return new UserListResponseDTO(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.isActive(),
                user.getMatricula(),
                celulaNome,
                user.getCreatedAt()
        );
    }
}