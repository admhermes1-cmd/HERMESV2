package com.hermes.dto.celula;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * DTO de entrada para criação e edição de células.
 *
 * @param nome     Nome identificador da célula (ex: "C1"). Obrigatório e único.
 * @param gestorId UUID do usuário que será gestor da célula.
 *                 Deve ter {@code role = GESTOR}; validado no service.
 */
public record CelulaRequestDTO(

        @NotBlank(message = "O nome da célula é obrigatório")
        String nome,

        @NotNull(message = "O gestor é obrigatório")
        UUID gestorId
) {}