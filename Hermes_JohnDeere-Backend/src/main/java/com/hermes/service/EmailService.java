package com.hermes.service;

import com.hermes.config.MailConfig;
import com.hermes.entity.Notification;
import com.hermes.entity.TemplateVersion;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Attachments;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Personalization;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Serviço de envio de e-mail do HERMES via SendGrid HTTP API.
 *
 * <p>Substitui a implementação anterior baseada em {@code JavaMailSender} (SMTP),
 * que era bloqueada pelo Railway em todas as portas (587, 465, 2525).
 * A API HTTP do SendGrid opera exclusivamente na porta 443 (HTTPS),
 * sem restrições em nenhum provedor de cloud.
 *
 * <p>Funcionalidades mantidas da implementação anterior:
 * <ul>
 *   <li>Destinatários TO, CC e BCC</li>
 *   <li>Corpo em HTML ou texto plano (detectado automaticamente)</li>
 *   <li>Substituição de variáveis no subject e no body ({@code {{variavel}}})</li>
 *   <li>Anexos via {@link MultipartFile}</li>
 * </ul>
 *
 * <p>Dependência necessária no {@code pom.xml}:
 * <pre>{@code
 * <dependency>
 *     <groupId>com.sendgrid</groupId>
 *     <artifactId>sendgrid-java</artifactId>
 *     <version>4.10.2</version>
 * </dependency>
 * }</pre>
 *
 * <p>Variável de ambiente necessária no Railway:
 * <pre>
 * MAIL_PASSWORD=SG.sua_api_key_aqui   (a API Key do SendGrid — campo username não é usado)
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    /** Padrão regex para identificar placeholders no formato {@code {{variavel}}}. */
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    /** Endpoint da API de envio de e-mail do SendGrid. */
    private static final String SENDGRID_MAIL_ENDPOINT = "mail/send";

    /** HTTP status de sucesso aceitos pelo SendGrid (202 Accepted). */
    private static final int SENDGRID_SUCCESS_STATUS = 202;

    private final MailConfig mailConfig;

    /**
     * A API Key do SendGrid é lida da variável {@code MAIL_PASSWORD} para manter
     * compatibilidade com as variáveis de ambiente já configuradas no Railway.
     * Injetada via {@link org.springframework.beans.factory.annotation.Value}.
     */
    @org.springframework.beans.factory.annotation.Value("${spring.mail.password}")
    private String sendGridApiKey;

    /**
     * Envia um e-mail via SendGrid HTTP API com base nos dados da notificação
     * e na versão do template.
     *
     * <p>O fluxo de composição segue esta ordem:
     * <ol>
     *   <li>Resolução de variáveis no subject e no body</li>
     *   <li>Detecção automática de HTML no body</li>
     *   <li>Composição do objeto {@link Mail} com remetente, destinatários e conteúdo</li>
     *   <li>Adição de anexos codificados em Base64</li>
     *   <li>Envio via {@link SendGrid} HTTP API</li>
     *   <li>Validação do status HTTP da resposta</li>
     * </ol>
     *
     * @param notification entidade de notificação com destinatários e variáveis de substituição
     * @param version      versão do template com subject e body originais
     * @param attachments  lista de arquivos a anexar; pode ser {@code null} ou vazia
     * @throws AppException {@code NOTIFICATION_SEND_FAILED} em caso de falha no envio
     *                      ou erro ao compor a mensagem
     */

    /**
     * Envia o e-mail de boas-vindas com as credenciais de acesso ao HERMES via SendGrid.
     *
     * <p>É disparado tanto na criação do usuário quanto na redefinição de senha.</p>
     *
     * @param to          endereço de e-mail do destinatário.
     * @param name        nome completo do usuário para personalização.
     * @param rawPassword senha em texto puro recém-gerada.
     */
    public void sendWelcomeEmail(String to, String name, String rawPassword) {
        String subject = "Seu acesso ao HERMES foi criado";

        String body = """
                Olá, %s!

                Seu acesso ao sistema HERMES foi criado com sucesso.

                E-mail: %s
                Senha temporária: %s

                Recomendamos que você solicite a alteração da sua senha ao administrador após o primeiro acesso.

                Atenciosamente,
                Equipe HERMES
                """.formatted(name, to, rawPassword);

        try {
            Email from = new Email(mailConfig.getFrom(), mailConfig.getFromName());
            Email recipient = new Email(to);
            Content content = new Content("text/plain", body);
            Mail mail = new Mail(from, subject, recipient, content);

            SendGrid sg = new SendGrid(sendGridApiKey);
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint(SENDGRID_MAIL_ENDPOINT);
            request.setBody(mail.build());

            Response response = sg.api(request);

            if (response.getStatusCode() != SENDGRID_SUCCESS_STATUS) {
                log.error("SendGrid retornou status {} ao enviar e-mail de boas-vindas para {}: {}",
                        response.getStatusCode(), to, response.getBody());
                throw AppException.internal(ErrorCode.USER_SEND_EMAIL_FAILED,
                        "Falha ao enviar e-mail de boas-vindas (status " + response.getStatusCode() + ")",
                        response.getBody());
            }

            log.info("E-mail de boas-vindas enviado para: {}", to);

        } catch (AppException ex) {
            throw ex;
        } catch (IOException ex) {
            log.error("Falha ao enviar e-mail de boas-vindas para {}: {}", to, ex.getMessage(), ex);
            throw AppException.internal(ErrorCode.USER_SEND_EMAIL_FAILED,
                    "Falha ao enviar e-mail de boas-vindas via SendGrid", ex.getMessage());
        }
    }


    public void sendEmail(Notification notification, TemplateVersion version,
                          List<MultipartFile> attachments) {
        log.debug("Compondo e-mail para notificação: {}", notification.getId());

        Map<String, String> variables = notification.getVariables();

        String resolvedSubject = resolveVariables(version.getSubject(), variables);
        String resolvedBody    = resolveVariables(version.getBody(), variables);
        boolean isHtml         = resolvedBody.contains("<");

        try {
            // ── Remetente ────────────────────────────────────────────────
            Email from = new Email(mailConfig.getFrom(), mailConfig.getFromName());

            // ── Destinatários via Personalization ─────────────────────────
            // SendGrid usa o objeto Personalization para TO, CC e BCC,
            // permitindo múltiplos destinatários por categoria.
            var recipients = notification.getRecipients();

            Personalization personalization = new Personalization();

            if (recipients.to() != null) {
                recipients.to().forEach(addr -> personalization.addTo(new Email(addr)));
            }
            if (recipients.cc() != null) {
                recipients.cc().forEach(addr -> personalization.addCc(new Email(addr)));
            }
            if (recipients.bcc() != null) {
                recipients.bcc().forEach(addr -> personalization.addBcc(new Email(addr)));
            }

            // ── Conteúdo ──────────────────────────────────────────────────
            // SendGrid exige ao menos um Content. Para HTML, incluímos também
            // uma versão text/plain como fallback para clientes que não renderizam HTML.
            String contentType = isHtml ? "text/html" : "text/plain";
            Content content = new Content(contentType, resolvedBody);

            // ── Montagem do Mail ──────────────────────────────────────────
            Mail mail = new Mail();
            mail.setFrom(from);
            mail.setSubject(resolvedSubject);
            mail.addPersonalization(personalization);
            mail.addContent(content);

            // Se for HTML, adiciona fallback text/plain (boas práticas de e-mail)
            if (isHtml) {
                String plainText = resolvedBody.replaceAll("<[^>]+>", "").trim();
                mail.addContent(new Content("text/plain", plainText));
            }

            // ── Anexos ────────────────────────────────────────────────────
            // SendGrid recebe anexos como Base64. O MultipartFile é lido em bytes
            // e codificado antes de ser adicionado ao payload JSON da API.
            if (attachments != null) {
                for (MultipartFile attachment : attachments) {
                    if (attachment != null && !attachment.isEmpty()) {
                        String filename = attachment.getOriginalFilename() != null
                                ? attachment.getOriginalFilename()
                                : "attachment";

                        Attachments sgAttachment = new Attachments();
                        sgAttachment.setFilename(filename);
                        sgAttachment.setContent(
                                Base64.getEncoder().encodeToString(attachment.getBytes())
                        );
                        sgAttachment.setType(
                                attachment.getContentType() != null
                                        ? attachment.getContentType()
                                        : "application/octet-stream"
                        );
                        sgAttachment.setDisposition("attachment");
                        mail.addAttachments(sgAttachment);
                    }
                }
            }

            // ── Envio via HTTP ────────────────────────────────────────────
            SendGrid sg = new SendGrid(sendGridApiKey);
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint(SENDGRID_MAIL_ENDPOINT);
            request.setBody(mail.build());

            Response response = sg.api(request);

            if (response.getStatusCode() != SENDGRID_SUCCESS_STATUS) {
                log.error("SendGrid retornou status {} para notificação {}: {}",
                        response.getStatusCode(), notification.getId(), response.getBody());
                throw AppException.internal(ErrorCode.NOTIFICATION_SEND_FAILED,
                        "SendGrid recusou o envio (status " + response.getStatusCode() + ")",
                        response.getBody());
            }

            int toCount = recipients.to() != null ? recipients.to().size() : 0;
            log.info("E-mail enviado com sucesso para {} destinatário(s) — notificação: {}",
                    toCount, notification.getId());

        } catch (AppException ex) {
            throw ex; // propaga sem reempacotar
        } catch (IOException ex) {
            log.error("Falha ao enviar e-mail para notificação {}: {}", notification.getId(), ex.getMessage(), ex);
            throw AppException.internal(ErrorCode.NOTIFICATION_SEND_FAILED,
                    "Falha ao enviar e-mail via SendGrid", ex.getMessage());
        }
    }

    /**
     * Substitui todas as ocorrências de {@code {{variavel}}} no texto pelo valor
     * correspondente no mapa de variáveis.
     *
     * <p>Variáveis presentes no texto mas ausentes no mapa são mantidas intactas.
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
            String key   = matcher.group(1);
            String value = variables.getOrDefault(key, matcher.group(0));
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);

        return result.toString();
    }
}
