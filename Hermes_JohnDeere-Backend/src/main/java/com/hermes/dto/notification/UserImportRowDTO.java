package com.hermes.dto.notification;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO que representa uma linha de usuário no arquivo CSV ou JSON de importação em massa.
 * <p>
 * Cada instância corresponde a um usuário a ser criado. A validação dos campos
 * é feita pelo {@code BulkImportService} antes de persistir no banco.
 * </p>
 *
 * @param name     Nome completo do usuário (obrigatório, mínimo 2 caracteres)
 * @param email    Endereço de e-mail único (obrigatório, formato válido)
 * @param role     Papel no sistema: ADMIN, MANAGER ou USER (obrigatório)
 * @param password Senha inicial opcional; se ausente, uma senha aleatória é gerada
 */
public record UserImportRowDTO(

        @NotBlank(message = "O nome é obrigatório")
        @Size(min = 2, max = 120, message = "O nome deve ter entre 2 e 120 caracteres")
        String name,

        @NotBlank(message = "O e-mail é obrigatório")
        @Email(message = "Formato de e-mail inválido")
        String email,

        @NotBlank(message = "O papel (role) é obrigatório")
        String role,

        String password
) {}