package com.hermes.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuração de e-mail do HERMES.
 *
 * <p>Centraliza as propriedades customizadas do HERMES — remetente, nome de exibição
 * e limite de tamanho de anexos — expondo-as para injeção nos services que enviam
 * e-mail.</p>
 *
 * <p>A implementação anterior usava {@code JavaMailSender} (SMTP). A implementação
 * atual usa a SendGrid HTTP API diretamente, eliminando a dependência de portas SMTP
 * bloqueadas em provedores de cloud como Railway.</p>
 *
 * <p><b>Configuração HERMES (application.yml):</b></p>
 * <pre>
 * hermes:
 *   mail:
 *     from: ${MAIL_FROM:noreply@hermes.com}
 *     from-name: ${MAIL_FROM_NAME:HERMES Notificações}
 *     max-size-bytes: 10485760   # 10 MB
 * </pre>
 */
@Configuration
public class MailConfig {

    @Value("${hermes.mail.from}")
    private String mailFrom;

    @Value("${hermes.mail.from-name}")
    private String mailFromName;

    @Value("${hermes.mail.max-size-bytes}")
    private long maxSizeBytes;

    /**
     * Retorna o endereço de e-mail do remetente.
     * Usado pelo {@code EmailService} para preencher o objeto {@link com.sendgrid.helpers.mail.objects.Email}.
     *
     * @return endereço de e-mail (ex: {@code noreply@hermes.com})
     */
    public String getFrom() {
        return mailFrom;
    }

    /**
     * Retorna o nome de exibição do remetente.
     * Combinado com {@link #getFrom()} pelo {@code EmailService} para compor o campo From.
     *
     * @return nome de exibição (ex: {@code HERMES Notificações})
     */
    public String getFromName() {
        return mailFromName;
    }

    /**
     * Retorna o tamanho máximo de anexos em bytes.
     *
     * @return tamanho máximo em bytes (padrão: 10.485.760 = 10 MB)
     */
    public long getMaxSizeBytes() {
        return maxSizeBytes;
    }

    /**
     * Formata o remetente no padrão RFC 5322: {@code "Nome <email>"}.
     * Mantido para compatibilidade com outros pontos do código que possam usá-lo.
     *
     * @return string no formato {@code "Nome <email>"}
     */
    public String getFormattedSender() {
        return String.format("%s <%s>", mailFromName, mailFrom);
    }
}