package com.hermes.dto.notification;

import com.hermes.entity.enums.NotificationChannel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO de requisição para envio ou agendamento de uma notificação.
 *
 * <p>Enviado pelo cliente no corpo da requisição {@code POST /notifications}.
 * O campo {@code scheduledAt} determina o modo de operação:</p>
 * <ul>
 *   <li>{@code null} — envio imediato</li>
 *   <li>data futura — agendamento via {@code ScheduledMessage}</li>
 * </ul>
 *
 * <p>Arquivos em si chegam via {@code multipart/form-data} em requisição separada;
 * este DTO transporta apenas os metadados dos anexos ({@link AttachmentMetadataDTO}).</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationRequestDTO {

    /**
     * Canal pelo qual a notificação será entregue.
     *
     * <p>Deve corresponder ao canal do template selecionado.</p>
     *
     * @see NotificationChannel
     */
    @NotNull(message = "Canal é obrigatório")
    private NotificationChannel channel;

    /**
     * Identificador do template que será utilizado para compor a mensagem.
     */
    @NotNull(message = "Template é obrigatório")
    private UUID templateId;

    /**
     * Identificador da versão específica do template a ser utilizada.
     *
     * <p>Opcional — se omitido, o service utiliza automaticamente a versão
     * mais recente e ativa do template.</p>
     */
    private UUID templateVersionId;

    /**
     * Destinatários da notificação organizados por tipo (Para, CC, BCC).
     *
     * <p>O campo {@code to} deve conter pelo menos um destinatário.
     * Validação em cascata ativada via {@code @Valid}.</p>
     */
    @NotNull(message = "Destinatários são obrigatórios")
    @Valid
    private RecipientsDTO recipients;

    /**
     * Mapa de variáveis para preenchimento das lacunas do template.
     *
     * <p>As chaves devem corresponder às variáveis declaradas na versão do template.
     * Ex: {@code {"nome": "João", "empresa": "Hermes"}}.</p>
     */
    private Map<String, String> variables = new HashMap<>();

    /**
     * Metadados dos arquivos anexados à notificação.
     *
     * <p>Contém apenas nome e tamanho — o conteúdo binário é enviado via
     * {@code multipart/form-data} em endpoint dedicado.</p>
     */
    private List<AttachmentMetadataDTO> attachments = new ArrayList<>();

    /**
     * Data e hora para agendamento da notificação.
     *
     * <p>{@code null} para envio imediato; qualquer valor futuro aciona
     * o mecanismo de agendamento ({@code ScheduledMessage}).</p>
     */
    private LocalDateTime scheduledAt;

    // -------------------------------------------------------------------------
    // Records internos
    // -------------------------------------------------------------------------

    /**
     * Destinatários da notificação organizados em Para, CC e BCC.
     *
     * @param to  lista de destinatários principais — pelo menos um obrigatório
     * @param cc  lista de destinatários em cópia — pode ser vazia ou nula
     * @param bcc lista de destinatários em cópia oculta — pode ser vazia ou nula
     */
    public record RecipientsDTO(
            @NotEmpty(message = "Pelo menos um destinatário é obrigatório")
            List<String> to,
            List<String> cc,
            List<String> bcc
    ) {}

    /**
     * Metadados de um arquivo anexado à notificação.
     *
     * <p>O campo {@code size} representa o tamanho do arquivo em bytes.</p>
     *
     * @param name nome original do arquivo (ex: {@code relatorio.pdf})
     * @param size tamanho do arquivo em bytes
     */
    public record AttachmentMetadataDTO(
            @NotBlank String name,
            long size
    ) {}
}