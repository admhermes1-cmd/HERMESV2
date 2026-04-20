package com.hermes.service;

import com.hermes.config.MailConfig;
import com.hermes.entity.Notification;
import com.hermes.entity.TemplateVersion;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Serviço de envio de e-mail do HERMES via Gmail SMTP.
 *
 * <p>Responsável pela composição e envio de {@link MimeMessage}, suportando:
 * <ul>
 *   <li>Destinatários TO, CC e BCC</li>
 *   <li>Corpo em HTML ou texto plano (detectado automaticamente)</li>
 *   <li>Substituição de variáveis no subject e no body ({@code {{variavel}}})</li>
 *   <li>Anexos via {@link MultipartFile}</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    /** Padrão regex para identificar placeholders de variáveis no formato {@code {{variavel}}}. */
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    private final JavaMailSender javaMailSender;
    private final MailConfig mailConfig;

    /**
     * Envia um e-mail via Gmail SMTP com base nos dados da notificação e na versão do template.
     *
     * <p>O fluxo de composição segue esta ordem:
     * <ol>
     *   <li>Criação do {@link MimeMessage} com suporte a multipart (para anexos)</li>
     *   <li>Configuração de remetente, destinatários, subject e body</li>
     *   <li>Substituição de variáveis no subject e no body</li>
     *   <li>Adição de anexos</li>
     *   <li>Envio via {@link JavaMailSender}</li>
     * </ol>
     *
     * <p>O corpo é interpretado como HTML se contiver o caractere {@code <},
     * caso contrário é enviado como texto plano.
     *
     * @param notification entidade de notificação contendo destinatários e variáveis de substituição
     * @param version      versão do template com o subject e body originais
     * @param attachments  lista de arquivos a anexar; pode ser {@code null} ou vazia
     * @throws AppException {@code NOTIFICATION_SEND_FAILED} em caso de falha no envio SMTP
     *                      ou erro ao compor a mensagem
     */
    public void sendEmail(Notification notification, TemplateVersion version,
                          List<MultipartFile> attachments) {
        log.debug("Compondo e-mail para notificação: {}", notification.getId());

        Map<String, String> variables = notification.getVariables();

        String resolvedSubject = resolveVariables(version.getSubject(), variables);
        String resolvedBody = resolveVariables(version.getBody(), variables);
        boolean isHtml = resolvedBody.contains("<");

        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            // Remetente
            helper.setFrom(mailConfig.getFormattedSender());

            // Destinatários
            var recipients = notification.getRecipients();

            if (recipients.to() != null && !recipients.to().isEmpty()) {
                helper.setTo(recipients.to().toArray(new String[0]));
            }
            if (recipients.cc() != null && !recipients.cc().isEmpty()) {
                helper.setCc(recipients.cc().toArray(new String[0]));
            }
            if (recipients.bcc() != null && !recipients.bcc().isEmpty()) {
                helper.setBcc(recipients.bcc().toArray(new String[0]));
            }

            // Conteúdo
            helper.setSubject(resolvedSubject);
            helper.setText(resolvedBody, isHtml);

            // Anexos
            if (attachments != null) {
                for (MultipartFile attachment : attachments) {
                    if (attachment != null && !attachment.isEmpty()) {
                        String filename = attachment.getOriginalFilename() != null
                                ? attachment.getOriginalFilename()
                                : "attachment";
                        helper.addAttachment(filename, attachment);
                    }
                }
            }

            javaMailSender.send(message);

            log.info("E-mail enviado com sucesso para {} destinatário(s) — notificação: {}",
                    recipients.to() != null ? recipients.to().size() : 0,
                    notification.getId());

        } catch (MailException | MessagingException ex) {
            log.error("Falha ao enviar e-mail para notificação {}: {}", notification.getId(), ex.getMessage(), ex);
            throw AppException.internal(ErrorCode.NOTIFICATION_SEND_FAILED,
                    "Falha ao enviar e-mail", ex.getMessage());
        }
    }

    /**
     * Substitui todas as ocorrências de {@code {{variavel}}} no texto pelo valor correspondente
     * encontrado no mapa de variáveis.
     *
     * <p>Variáveis presentes no texto mas ausentes no mapa são mantidas intactas
     * ({@code {{variavel}}} permanece no resultado final).
     *
     * @param template  texto original contendo lacunas no formato {@code {{variavel}}}
     * @param variables mapa de chave-valor para substituição das lacunas
     * @return texto com todas as variáveis conhecidas substituídas pelos seus valores
     */
    private String resolveVariables(String template, Map<String, String> variables) {
        if (template == null || template.isBlank()) {
            return template;
        }
        if (variables == null || variables.isEmpty()) {
            return template;
        }

        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();

        while (matcher.find()) {
            String key = matcher.group(1);
            String value = variables.getOrDefault(key, matcher.group(0));
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);

        return result.toString();
    }
}