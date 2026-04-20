package com.hermes.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO de requisição para autenticação de usuário.
 *
 * <p>Enviado pelo cliente no corpo da requisição {@code POST /auth/login}.
 * Todos os campos são obrigatórios e passam por validação via Jakarta Bean Validation
 * antes de atingir a camada de serviço.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequestDTO {

    /**
     * Endereço de e-mail do usuário.
     *
     * <p>Deve ser um e-mail válido e não pode ser vazio ou nulo.</p>
     */
    @NotBlank(message = "E-mail é obrigatório")
    @Email(message = "E-mail inválido")
    private String email;

    /**
     * Senha do usuário em texto plano.
     *
     * <p>A senha deve ter no mínimo 6 caracteres. Nunca é persistida ou
     * retornada em responses — usada apenas para autenticação.</p>
     */
    @NotBlank(message = "Senha é obrigatória")
    @Size(min = 6, message = "Senha deve ter no mínimo 6 caracteres")
    private String password;
}