package com.hermes.dto.template;

import com.hermes.entity.enums.TemplateChannel;

import com.hermes.entity.enums.TemplateChannel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO de requisição para criação e atualização de templates de notificação.
 *
 * <p>Utilizado em dois endpoints:</p>
 * <ul>
 *   <li>{@code POST /templates} — criação: todos os campos são avaliados, incluindo {@code channel}.</li>
 *   <li>{@code PUT /templates/:id} — atualização: o campo {@code channel} deve ser ignorado
 *       pelo service, pois o canal é imutável após a criação.</li>
 * </ul>
 *
 * <p>As validações {@link jakarta.validation.constraints} são aplicadas automaticamente
 * quando o controller utiliza {@code @Valid} ou {@code @Validated} no parâmetro.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateRequestDTO {

    /**
     * Nome identificador do template.
     *
     * <p>Obrigatório, não pode ser vazio e deve ter no máximo 100 caracteres.</p>
     */
    @NotBlank(message = "Nome é obrigatório")
    @Size(max = 100, message = "Nome deve ter no máximo 100 caracteres")
    private String name;

    /**
     * Descrição opcional que descreve a finalidade do template.
     *
     * <p>Quando fornecida, deve ter no máximo 500 caracteres.</p>
     */
    @Size(max = 500, message = "Descrição deve ter no máximo 500 caracteres")
    private String description;

    /**
     * Canal de entrega para o qual o template foi criado.
     *
     * <p>Obrigatório na criação. <strong>Imutável após a criação</strong> — o service
     * deve ignorar este campo em operações de atualização ({@code PUT}).</p>
     *
     * @see TemplateChannel
     */
    @NotNull(message = "Canal é obrigatório")
    private TemplateChannel channel;

    /**
     * Primeira versão do template a ser criada junto com o template.
     *
     * <p>Obrigatório na criação.</p>
     */
    @NotNull(message = "Versão é obrigatória")
    private TemplateVersionRequestDTO version;
}