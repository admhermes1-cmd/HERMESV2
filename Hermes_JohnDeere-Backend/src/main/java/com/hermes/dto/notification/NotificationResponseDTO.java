package com.hermes.dto.notification;

import com.hermes.entity.Notification;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO de resposta que representa uma notificação no sistema HERMES.
 *
 * <p>Retornado pelos endpoints {@code GET /notifications}, {@code GET /notifications/:id}
 * e {@code POST /notifications}.</p>
 *
 * <p>Os records {@link RecipientsDTO} e {@link AttachmentMetadataDTO} são os mesmos
 * definidos em {@link NotificationRequestDTO} e importados do mesmo pacote para
 * garantir consistência de shape entre request e response.</p>
 *
 * @param id                identificador único da notificação
 * @param channel           canal de entrega utilizado
 * @param status            status atual ({@code PENDING}, {@code SENT}, {@code FAILED}, {@code SCHEDULED})
 * @param templateId        identificador do template utilizado
 * @param templateVersionId identificador da versão do template utilizada
 * @param recipients        destinatários agrupados por Para, CC e BCC
 * @param variables         variáveis aplicadas ao corpo do template
 * @param attachments       metadados dos arquivos anexados
 * @param scheduledAt       data/hora de agendamento ({@code null} se envio imediato)
 * @param sentAt            data/hora efetiva de envio ({@code null} se ainda não enviado)
 * @param error             descrição do erro em caso de falha ({@code null} se bem-sucedido)
 * @param createdBy         UUID do usuário que criou a notificação
 * @param createdAt         data e hora de criação do registro
 */
public record NotificationResponseDTO(
        UUID id,
        String channel,
        String status,
        UUID templateId,
        UUID templateVersionId,
        NotificationRequestDTO.RecipientsDTO recipients,
        Map<String, String> variables,
        List<NotificationRequestDTO.AttachmentMetadataDTO> attachments,
        LocalDateTime scheduledAt,
        LocalDateTime sentAt,
        String error,
        UUID createdBy,
        LocalDateTime createdAt
) {

    /**
     * Converte a entidade {@link Notification} para {@link NotificationResponseDTO}.
     *
     * <p>Os campos {@code recipients} e {@code attachments} são mapeados a partir
     * dos tipos embutidos na entidade ({@code RecipientsData} e {@code AttachmentMetadata})
     * para os records do pacote DTO, garantindo o shape esperado pelo frontend.</p>
     *
     * @param notification entidade do domínio
     * @return DTO pronto para serialização JSON
     */
    public static NotificationResponseDTO from(Notification notification) {
        // Mapeamento de RecipientsData da entidade para o record DTO
        NotificationRequestDTO.RecipientsDTO recipientsDTO = null;
        if (notification.getRecipients() != null) {
            recipientsDTO = new NotificationRequestDTO.RecipientsDTO(
                    notification.getRecipients().to(),
                    notification.getRecipients().cc(),
                    notification.getRecipients().bcc()
            );
        }

        // Mapeamento de List<AttachmentMetadata> da entidade para List<AttachmentMetadataDTO>
        List<NotificationRequestDTO.AttachmentMetadataDTO> attachmentsDTO =
                notification.getAttachments() != null
                        ? notification.getAttachments().stream()
                                .map(a -> new NotificationRequestDTO.AttachmentMetadataDTO(
                                        a.name(), a.size()))
                                .toList()
                        : List.of();

        return new NotificationResponseDTO(
                notification.getId(),
                notification.getChannel().name(),
                notification.getStatus().name(),
                notification.getTemplateId(),
                notification.getTemplateVersionId(),
                recipientsDTO,
                notification.getVariables() != null ? Map.copyOf(notification.getVariables()) : Map.of(),
                attachmentsDTO,
                notification.getScheduledAt(),
                notification.getSentAt(),
                notification.getError(),
                notification.getCreatedBy(),
                notification.getCreatedAt()
        );
    }
}