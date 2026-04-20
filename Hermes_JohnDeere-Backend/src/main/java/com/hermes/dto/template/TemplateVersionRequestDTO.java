package com.hermes.dto.template;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * DTO de requisição para criação e atualização de versões de templates.
 *
 * <p>Utilizado em dois endpoints:</p>
 * <ul>
 *   <li>{@code POST /templates/:id/versions} — criação de nova versão: o campo
 *       {@code isActive} é ignorado, pois o service decide a ativação.</li>
 *   <li>{@code PUT /templates/:id/versions/:versionId} — atualização: o campo
 *       {@code isActive} é considerado para ativar/desativar a versão.</li>
 * </ul>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateVersionRequestDTO {

    /**
     * Assunto da mensagem.
     *
     * <p>Opcional para canais {@code SMS} e {@code WHATSAPP}; recomendado para
     * {@code EMAIL}. Quando fornecido, deve ter no máximo 200 caracteres.</p>
     */
    @Size(max = 200, message = "Assunto deve ter no máximo 200 caracteres")
    private String subject;

    /**
     * Corpo da mensagem com suporte a variáveis no formato {@code {{nomeVariavel}}}.
     *
     * <p>Campo obrigatório — não pode ser nulo nem vazio.</p>
     */
    @NotBlank(message = "Corpo da mensagem é obrigatório")
    private String body;

    /**
     * Lista de variáveis identificadas no corpo da mensagem pelo frontend.
     *
     * <p>O backend pode revalidar essa lista comparando com as variáveis
     * efetivamente presentes no {@code body}. Inicializada como lista vazia
     * para evitar {@link NullPointerException} em iterações.</p>
     */
    private List<String> variables = new ArrayList<>();

    /**
     * Define se esta versão deve ser marcada como ativa.
     *
     * <p><strong>Apenas no update</strong> ({@code PUT}) — ignorado na criação.
     * Quando {@code true}, o service deve desativar as demais versões do template.</p>
     */
    private Boolean isActive;
}