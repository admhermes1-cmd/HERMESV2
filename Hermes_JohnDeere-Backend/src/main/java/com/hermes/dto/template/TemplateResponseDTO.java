package com.hermes.dto.template;

import com.hermes.entity.Template;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO de resposta que representa um template de notificação.
 *
 * <p>Retornado pelos endpoints {@code GET /templates}, {@code GET /templates/:id},
 * {@code POST /templates} e {@code PUT /templates/:id}.</p>
 *
 * <p>Dois factory methods estão disponíveis para evitar o problema de N+1 queries
 * em listagens: {@link #from(Template)} carrega as versões, enquanto
 * {@link #fromWithoutVersions(Template)} as omite para maior performance.</p>
 *
 * @param id         identificador único do template
 * @param name       nome do template
 * @param description descrição da finalidade do template
 * @param channel    canal de entrega ({@code EMAIL}, {@code SMS} ou {@code WHATSAPP})
 * @param versions   lista de versões do template — pode ser {@code null} em listagens
 * @param createdBy  UUID do usuário que criou o template
 * @param createdAt  data e hora de criação
 * @param updatedAt  data e hora da última atualização
 */
public record TemplateResponseDTO(
        UUID id,
        String name,
        String description,
        String channel,
        List<TemplateVersionResponseDTO> versions,
        UUID createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    /**
     * Converte a entidade {@link Template} para {@link TemplateResponseDTO} incluindo
     * todas as versões associadas.
     *
     * <p>Use este método para endpoints de detalhe ({@code GET /templates/:id}),
     * onde o cliente precisa das versões para renderizar o editor.</p>
     *
     * @param template entidade do template com versões já carregadas (eager ou inicializadas)
     * @return DTO completo com versões mapeadas
     */
    public static TemplateResponseDTO from(Template template) {
        List<TemplateVersionResponseDTO> versions = template.getVersions() != null
                ? template.getVersions().stream()
                        .map(TemplateVersionResponseDTO::from)
                        .toList()
                : List.of();

        return new TemplateResponseDTO(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.getChannel().name(),
                versions,
                template.getCreatedBy(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }

    /**
     * Converte a entidade {@link Template} para {@link TemplateResponseDTO} sem incluir
     * as versões — adequado para endpoints de listagem ({@code GET /templates}).
     *
     * <p>Evita o carregamento desnecessário de coleções em listagens paginadas,
     * prevenindo o problema de N+1 queries. O campo {@code versions} será
     * {@code null} no JSON resultante.</p>
     *
     * @param template entidade do template
     * @return DTO sem versões para uso em listagens
     */
    public static TemplateResponseDTO fromWithoutVersions(Template template) {
        return new TemplateResponseDTO(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.getChannel().name(),
                null,
                template.getCreatedBy(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }
}