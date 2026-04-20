package com.hermes.dto.template;

import com.hermes.entity.TemplateVersion;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO de resposta que representa uma versão específica de um template.
 *
 * <p>Retornado individualmente nos endpoints de versão e embutido no array
 * {@code versions} do {@link TemplateResponseDTO}.</p>
 *
 * @param id            identificador único da versão
 * @param templateId    identificador do template pai
 * @param versionNumber número sequencial da versão (começa em 1)
 * @param subject       assunto da mensagem — relevante para canal {@code EMAIL};
 *                      pode ser {@code null} para SMS e WhatsApp
 * @param body          corpo da mensagem com variáveis no formato {@code {{variavel}}}
 * @param variables     lista de variáveis detectadas no corpo da mensagem
 * @param isActive      indica se esta é a versão ativa do template
 * @param createdAt     data e hora de criação da versão
 */
public record TemplateVersionResponseDTO(
        UUID id,
        UUID templateId,
        Integer versionNumber,
        String subject,
        String body,
        List<String> variables,
        boolean isActive,
        LocalDateTime createdAt
) {

    /**
     * Converte a entidade {@link TemplateVersion} para {@link TemplateVersionResponseDTO}.
     *
     * @param version entidade de versão do template
     * @return DTO pronto para serialização JSON
     */
    public static TemplateVersionResponseDTO from(TemplateVersion version) {
        return new TemplateVersionResponseDTO(
                version.getId(),
                version.getTemplate().getId(),
                version.getVersionNumber(),
                version.getSubject(),
                version.getBody(),
                version.getVariables() != null ? List.copyOf(version.getVariables()) : List.of(),
                version.isActive(),
                version.getCreatedAt()
        );
    }
}