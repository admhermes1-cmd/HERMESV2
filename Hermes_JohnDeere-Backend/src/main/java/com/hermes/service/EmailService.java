package com.hermes.service;

import com.hermes.config.MailConfig;
import com.hermes.entity.Notification;
import com.hermes.entity.TemplateVersion;
import com.hermes.entity.User;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import com.hermes.repository.UserRepository;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
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
 * sem restrições em nenhum provedor de cloud.</p>
 *
 * <p><strong>Ordem de resolução de variáveis no envio:</strong></p>
 * <ol>
 *   <li>{@link #resolveFixedVariables(String, User, LocalDateTime)} — variáveis automáticas
 *       derivadas do destinatário e do sistema.</li>
 *   <li>{@link #resolveVariables(String, Map)} — variáveis dinâmicas fornecidas pelo usuário
 *       no payload da notificação.</li>
 * </ol>
 *
 * <p>Variáveis fixas são resolvidas antes das dinâmicas para evitar colisões acidentais.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    /** Padrão regex para identificar placeholders no formato {@code {{variavel}}}. */
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    /** Endpoint da API de envio de e-mail do SendGrid. */
    private static final String SENDGRID_MAIL_ENDPOINT = "mail/send";

    /** HTTP status de sucesso aceito pelo SendGrid (202 Accepted). */
    private static final int SENDGRID_SUCCESS_STATUS = 202;

    // ─── Formatadores de data/hora (PT-BR) ───────────────────────────────────

    private static final DateTimeFormatter FMT_DATA        = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_DATA_HORA   = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");
    private static final DateTimeFormatter FMT_ANO         = DateTimeFormatter.ofPattern("yyyy");

    /** Nomes dos meses em português, indexados por valor (1 = Janeiro). */
    private static final String[] MESES_PT = {
        "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    };

    /** Nomes dos dias da semana em português, indexados por DayOfWeek.getValue() (1 = Segunda). */
    private static final String[] DIAS_SEMANA_PT = {
        "", "Segunda-feira", "Terça-feira", "Quarta-feira",
        "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"
    };

    private final MailConfig mailConfig;
    private final UserRepository userRepository;

    /**
     * A API Key do SendGrid é lida da variável {@code MAIL_PASSWORD} para manter
     * compatibilidade com as variáveis de ambiente já configuradas no Railway.
     */
    @org.springframework.beans.factory.annotation.Value("${spring.mail.password}")
    private String sendGridApiKey;

    // =========================================================================
    // Envio — welcome email
    // =========================================================================

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
            Email from       = new Email(mailConfig.getFrom(), mailConfig.getFromName());
            Email recipient  = new Email(to);
            Content content  = new Content("text/plain", body);
            Mail mail        = new Mail(from, subject, recipient, content);

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

    // =========================================================================
    // Envio — notificação com template
    // =========================================================================

    /**
     * Envia um e-mail via SendGrid HTTP API com base nos dados da notificação
     * e na versão do template.
     *
     * <p>Ordem de resolução de variáveis:</p>
     * <ol>
     *   <li>Variáveis fixas automáticas ({@code {{PRIMEIRO_NOME}}}, {@code {{MATRICULA}}}, etc.)
     *       resolvidas pelo destinatário principal (primeiro endereço em TO).</li>
     *   <li>Variáveis dinâmicas fornecidas pelo usuário no payload da notificação.</li>
     * </ol>
     *
     * @param notification entidade de notificação com destinatários e variáveis de substituição.
     * @param version      versão do template com subject e body originais.
     * @param attachments  lista de arquivos a anexar; pode ser {@code null} ou vazia.
     * @throws AppException {@code NOTIFICATION_SEND_FAILED} em caso de falha no envio.
     */
    public void sendEmail(Notification notification, TemplateVersion version,
                          List<MultipartFile> attachments) {
        log.debug("Compondo e-mail para notificação: {}", notification.getId());

        Map<String, String> variables = notification.getVariables();
        LocalDateTime sentAt = LocalDateTime.now();

        // ── Resolver destinatário principal para variáveis fixas ──────────────
        // Usa o primeiro endereço TO como referência para busca do usuário no banco.
        var recipients = notification.getRecipients();
        String primaryRecipientEmail = (recipients.to() != null && !recipients.to().isEmpty())
                ? recipients.to().get(0)
                : null;

        User recipientUser = null;
        if (primaryRecipientEmail != null) {
            recipientUser = userRepository.findByEmail(primaryRecipientEmail).orElse(null);
            if (recipientUser == null) {
                log.debug("Destinatário principal '{}' não encontrado no banco — variáveis fixas mantidas como placeholder.",
                        primaryRecipientEmail);
            }
        }

        // ── Resolução em duas etapas ───────────────────────────────────────────
        // 1. Fixas primeiro (derivadas do usuário/sistema)
        // 2. Dinâmicas em seguida (fornecidas pelo payload da notificação)
        String resolvedSubject = resolveFixedVariables(version.getSubject(), recipientUser, sentAt);
        resolvedSubject        = resolveVariables(resolvedSubject, variables);

        String resolvedBody    = resolveFixedVariables(version.getBody(), recipientUser, sentAt);
        resolvedBody           = resolveVariables(resolvedBody, variables);

        boolean isHtml = resolvedBody.contains("<");

        try {
            // ── Remetente ────────────────────────────────────────────────
            Email from = new Email(mailConfig.getFrom(), mailConfig.getFromName());

            // ── Destinatários via Personalization ─────────────────────────
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
            String contentType = isHtml ? "text/html" : "text/plain";
            Content content    = new Content(contentType, resolvedBody);

            // ── Montagem do Mail ──────────────────────────────────────────
            Mail mail = new Mail();
            mail.setFrom(from);
            mail.setSubject(resolvedSubject);
            mail.addPersonalization(personalization);
            mail.addContent(content);

            if (isHtml) {
                String plainText = resolvedBody.replaceAll("<[^>]+>", "").trim();
                mail.addContent(new Content("text/plain", plainText));
            }

            // ── Anexos ────────────────────────────────────────────────────
            if (attachments != null) {
                for (MultipartFile attachment : attachments) {
                    if (attachment != null && !attachment.isEmpty()) {
                        String filename = attachment.getOriginalFilename() != null
                                ? attachment.getOriginalFilename()
                                : "attachment";

                        Attachments sgAttachment = new Attachments();
                        sgAttachment.setFilename(filename);
                        sgAttachment.setContent(Base64.getEncoder().encodeToString(attachment.getBytes()));
                        sgAttachment.setType(attachment.getContentType() != null
                                ? attachment.getContentType()
                                : "application/octet-stream");
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
            throw ex;
        } catch (IOException ex) {
            log.error("Falha ao enviar e-mail para notificação {}: {}", notification.getId(), ex.getMessage(), ex);
            throw AppException.internal(ErrorCode.NOTIFICATION_SEND_FAILED,
                    "Falha ao enviar e-mail via SendGrid", ex.getMessage());
        }
    }

    // =========================================================================
    // Resolução de variáveis
    // =========================================================================

    /**
     * Resolve todas as variáveis fixas automáticas no texto informado.
     *
     * <p>Variáveis derivadas do usuário ficam como placeholder se o destinatário
     * for {@code null} ou se o campo correspondente for {@code null} no banco.
     * Variáveis geradas pelo sistema (data, hora, saudação) são sempre resolvidas.</p>
     *
     * @param text      texto com placeholders no formato {@code {{VARIAVEL}}}.
     * @param recipient usuário destinatário; pode ser {@code null}.
     * @param sentAt    instante do envio para cálculo das variáveis temporais.
     * @return texto com variáveis fixas substituídas.
     */
    public String resolveFixedVariables(String text, User recipient, LocalDateTime sentAt) {
        if (text == null || text.isBlank()) {
            return text;
        }

        Map<String, String> fixed = new HashMap<>();

        // ── Variáveis do usuário ───────────────────────────────────────────────
        if (recipient != null) {
            String fullName = recipient.getName() != null ? recipient.getName().trim() : "";
            String[] parts  = fullName.split("\\s+");

            String primeiroNome        = parts.length > 0 ? parts[0] : fullName;
            String primeiroUltimoNome  = parts.length > 1
                    ? parts[0] + " " + parts[parts.length - 1]
                    : fullName;

            fixed.put(FixedVariables.PRIMEIRO_NOME,        primeiroNome);
            fixed.put(FixedVariables.PRIMEIRO_ULTIMO_NOME, primeiroUltimoNome);
            fixed.put(FixedVariables.NOME_COMPLETO,        fullName);
            fixed.put(FixedVariables.EMAIL,                recipient.getEmail());

            if (recipient.getMatricula() != null) {
                fixed.put(FixedVariables.MATRICULA, String.valueOf(recipient.getMatricula()));
            }
            if (recipient.getCargo() != null) {
                fixed.put(FixedVariables.CARGO, recipient.getCargo());
            }

            // ── Variáveis da célula ────────────────────────────────────────────
            var celula = recipient.getCelula();
            if (celula != null) {
                fixed.put(FixedVariables.NOME_CELULA, celula.getNome());

                var gestor = celula.getGestor();
                if (gestor != null) {
                    String gestorFullName = gestor.getName() != null ? gestor.getName().trim() : "";
                    String[] gestorParts  = gestorFullName.split("\\s+");

                    fixed.put(FixedVariables.GESTOR_NOME,          gestorFullName);
                    fixed.put(FixedVariables.GESTOR_PRIMEIRO_NOME, gestorParts.length > 0 ? gestorParts[0] : gestorFullName);
                    fixed.put(FixedVariables.GESTOR_EMAIL,         gestor.getEmail());
                }
            }
        }

        // ── Variáveis do sistema ───────────────────────────────────────────────
        LocalDateTime ref = sentAt != null ? sentAt : LocalDateTime.now();

        fixed.put(FixedVariables.DATA_HOJE,       ref.format(FMT_DATA));
        fixed.put(FixedVariables.DATA_HORA_ENVIO, ref.format(FMT_DATA_HORA));
        fixed.put(FixedVariables.MES_ANO,         MESES_PT[ref.getMonthValue()] + " de " + ref.format(FMT_ANO));
        fixed.put(FixedVariables.ANO,             ref.format(FMT_ANO));
        fixed.put(FixedVariables.DIA_SEMANA,      DIAS_SEMANA_PT[ref.getDayOfWeek().getValue()]);
        fixed.put(FixedVariables.SAUDACAO,        buildSaudacao(ref.getHour()));

        return resolveVariables(text, fixed);
    }

    /**
     * Substitui todas as ocorrências de {@code {{variavel}}} no texto pelo valor
     * correspondente no mapa de variáveis.
     *
     * <p>Variáveis presentes no texto mas ausentes no mapa são mantidas intactas.</p>
     *
     * <p><strong>Nota sobre {@code VARIABLE_PATTERN}:</strong> o padrão usa a flag {@code g}
     * implicitamente via {@code Matcher}. O {@code Matcher} é criado a cada chamada, portanto
     * não há risco de estado residual no {@code lastIndex} entre invocações.</p>
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

    // =========================================================================
    // Auxiliares privados
    // =========================================================================

    /**
     * Retorna a saudação adequada com base na hora do dia.
     *
     * <ul>
     *   <li>0h–11h59 → "Bom dia"</li>
     *   <li>12h–17h59 → "Boa tarde"</li>
     *   <li>18h–23h59 → "Boa noite"</li>
     * </ul>
     *
     * @param hora hora do dia (0–23).
     * @return string de saudação em português.
     */
    private String buildSaudacao(int hora) {
        if (hora < 12) return "Bom dia";
        if (hora < 18) return "Boa tarde";
        return "Boa noite";
    }
}
