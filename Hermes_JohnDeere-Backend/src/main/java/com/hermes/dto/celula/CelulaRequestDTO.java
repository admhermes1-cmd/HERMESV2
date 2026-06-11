package com.hermes.dto.celula;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

/**
 * DTO de entrada para criação e edição de células.
 *
 * @param nome     Nome identificador da célula (ex: "C1"). Obrigatório e único.
 * @param gestorId UUID do usuário que será gestor da célula. Opcional — uma célula
 *                 pode existir sem gestor atribuído. Quando informado, o usuário
 *                 deve ter {@code role = GESTOR} e não pode já gerenciar outra célula;
 *                 validado no service.
 */
public record CelulaRequestDTO(

        @NotBlank(message = "O nome da célula é obrigatório")
        String nome,

        UUID gestorId
) {}