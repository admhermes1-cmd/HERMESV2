package com.hermes.dto.user;

import com.hermes.model.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * DTO de entrada para criação e edição de usuários.
 *
 * <p>Na criação (POST), o campo {@code email} é obrigatório e será validado como único.
 * Na edição (PUT), o campo {@code email} é ignorado pelo serviço — o e-mail é imutável
 * após a criação.</p>
 *
 * <p>A senha nunca é recebida neste DTO; ela é gerada automaticamente pelo backend.</p>
 */
public record UserRequestDTO(

        /**
         * Nome completo do usuário.
         */
        @NotBlank(message = "O nome é obrigatório")
        String name,

        /**
         * Endereço de e-mail. Obrigatório apenas na criação; ignorado na edição.
         */
        @Email(message = "Formato de e-mail inválido")
        String email,

        /**
         * Papel do usuário no sistema.
         */
        @NotNull(message = "O papel (role) é obrigatório")
        UserRole role,

        /**
         * Indica se o usuário está ativo. Opcional na criação (padrão {@code true}).
         */
        Boolean isActive
) {}
