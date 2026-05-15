package com.hermes.dto.dashboard;

import com.hermes.entity.Notification;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO de resposta que representa uma entrada no log de atividades do dashboard HERMES.
 *
 * <p>Retornado de forma paginada pelo endpoint {@code GET /dashboard/logs}.
 * As entradas são derivadas das notificações processadas pelo sistema, com seu
 * status mapeado para um nível de severidade compatível com o frontend.</p>
 *
 * <p>Mapeamento de status para nível de log:</p>
 * <ul>
 *   <li>{@code SENT}      → {@code INFO}</li>
 *   <li>{@code PENDING}   → {@code INFO}</li>
 *   <li>{@code SCHEDULED} → {@code WARN}</li>
 *   <li>{@code FAILED}    → {@code ERROR}</li>
 * </ul>
 *
 * @param id        identificador da notificação de origem
 * @param level     severidade da entrada ({@code INFO}, {@code WARN} ou {@code ERROR})
 * @param message   mensagem descritiva da operação ou do erro ocorrido
 * @param context   informações contextuais adicionais (ex: canal, destinatário principal)
 * @param createdAt data e hora de criação da notificação
 */
public record LogEntryDTO(
        UUID id,
        String level,
        String message,
        String context,
        LocalDateTime createdAt
) {

    /**
     * Converte uma entidade {@link Notification} para {@link LogEntryDTO} para exibição
     * no painel de logs do dashboard.
     *
     * <p>A mensagem é construída a partir do status da notificação e do canal utilizado.
     * O contexto inclui o canal e o primeiro destinatário da lista {@code to} como
     * referência rápida para o operador.</p>
     *
     * @param notification entidade da notificação
     * @return entrada de log pronta para exibição no dashboard
     */
    public static LogEntryDTO fromNotification(Notification notification) {
        String level = resolveLevel(notification.getStatus().name());
        String message = buildMessage(notification);
        String context = buildContext(notification);

        return new LogEntryDTO(
                notification.getId(),
                level,
                message,
                context,
                notification.getCreatedAt()
        );
    }

    // -------------------------------------------------------------------------
    // Helpers privados
    // -------------------------------------------------------------------------

    /**
     * Mapeia o status da notificação para o nível de log correspondente.
     *
     * @param status nome do enum {@code NotificationStatus}
     * @return nível de log: {@code INFO}, {@code WARN} ou {@code ERROR}
     */
    private static String resolveLevel(String status) {
        return switch (status) {
            case "SENT", "PENDING" -> "INFO";
            case "SCHEDULED"       -> "WARN";
            case "FAILED"          -> "ERROR";
            default                -> "INFO";
        };
    }

    /**
     * Constrói a mensagem descritiva com base no status da notificação.
     *
     * @param notification entidade da notificação
     * @return mensagem legível para exibição no log
     */
    private static String buildMessage(Notification notification) {
        String channel = notification.getChannel().name();
        return switch (notification.getStatus().name()) {
            case "SENT"      -> "Notificação %s enviada com sucesso.".formatted(channel);
            case "PENDING"   -> "Notificação %s aguardando processamento.".formatted(channel);
            case "SCHEDULED" -> "Notificação %s agendada para %s.".formatted(
                    channel, notification.getScheduledAt());
            case "FAILED"    -> "Falha ao enviar notificação %s: %s".formatted(
                    channel, notification.getError() != null ? notification.getError() : "erro desconhecido");
            default          -> "Notificação %s registrada.".formatted(channel);
        };
    }

    /**
     * Constrói o contexto da entrada de log com canal e primeiro destinatário.
     *
     * @param notification entidade da notificação
     * @return string de contexto no formato {@code "CANAL → destinatario@email.com"}, ou
     *         apenas o canal se não houver destinatários
     */
    private static String buildContext(Notification notification) {
        String channel = notification.getChannel().name();

        if (notification.getRecipients() != null
                && notification.getRecipients().to() != null
                && !notification.getRecipients().to().isEmpty()) {
            String firstRecipient = notification.getRecipients().to().get(0);
            return "%s → %s".formatted(channel, firstRecipient);
        }

        return channel;
    }
}