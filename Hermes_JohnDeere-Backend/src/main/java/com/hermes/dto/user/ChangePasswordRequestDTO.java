package com.hermes.dto.user;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO de entrada para o endpoint de troca de senha ({@code POST /auth/change-password}).
 *
 * <p>Recebe a senha atual (para verificação) e a nova senha desejada.
 * Todas as regras de complexidade são validadas no {@code UserService}.</p>
 *
 * @param currentPassword Senha atual do usuário — usada para autenticação da operação.
 * @param newPassword     Nova senha desejada — deve cumprir todos os critérios de complexidade.
 */
public record ChangePasswordRequestDTO(

        @NotBlank(message = "A senha atual é obrigatória")
        String currentPassword,

        @NotBlank(message = "A nova senha é obrigatória")
        String newPassword
) {}