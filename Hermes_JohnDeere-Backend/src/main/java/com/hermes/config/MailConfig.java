package com.hermes.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Configuração de e-mail do HERMES.
 *
 * <p>O {@link JavaMailSender} é auto-configurado pelo Spring Boot via {@code spring.mail.*}
 * (host SMTP, porta, credenciais). Esta classe centraliza as propriedades customizadas
 * do HERMES — remetente, nome de exibição e limite de tamanho de anexos —
 * expondo-as para injeção nos services que enviam e-mail.</p>
 *
 * <p><b>Uso principal:</b> O {@code EmailService} injeta este {@code MailConfig}
 * para montar os headers dos e-mails ({@code From}, {@code Reply-To}) e validar
 * o tamanho de anexos antes do envio.</p>
 *
 * <p><b>Configuração SMTP (application.yml):</b></p>
 * <pre>
 * spring:
 *   mail:
 *     host: smtp.gmail.com
 *     port: 587
 *     username: ${MAIL_USERNAME}
 *     password: ${MAIL_PASSWORD}
 * </pre>
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
@Slf4j
@Configuration
public class MailConfig {

    /**
     * Endereço de e-mail do remetente.
     * Configurável via variável de ambiente {@code MAIL_FROM}.
     * Valor padrão: {@code noreply@hermes.com}
     */
    @Value("${hermes.mail.from}")
    private String mailFrom;

    /**
     * Nome de exibição do remetente (aparece no campo "De:" do e-mail).
     * Configurável via variável de ambiente {@code MAIL_FROM_NAME}.
     * Valor padrão: {@code HERMES Notificações}
     */
    @Value("${hermes.mail.from-name}")
    private String mailFromName;

    /**
     * Tamanho máximo de anexos em bytes.
     * Configurável via propriedade {@code hermes.mail.max-size-bytes}.
     * Valor padrão: {@code 10485760} (10 MB).
     *
     * <p>O {@code EmailService} deve rejeitar anexos maiores que este limite
     * antes de tentar o envio, retornando erro de validação ao chamador.</p>
     */
    @Value("${hermes.mail.max-size-bytes}")
    private long maxSizeBytes;

    /**
     * Instância de {@link JavaMailSender} auto-configurada pelo Spring Boot.
     *
     * <p>O Spring Boot auto-configura o {@code JavaMailSender} com base em
     * {@code spring.mail.*}. A injeção via {@code @Autowired} garante que
     * usamos exatamente a instância gerenciada pelo container, com todas as
     * configurações de connection pool, timeout e TLS aplicadas.</p>
     */
    @Autowired
    private JavaMailSender autoConfiguredMailSender;

    /**
     * Expõe o {@link JavaMailSender} auto-configurado pelo Spring Boot como bean nomeado.
     *
     * <p>O JavaMailSender é auto-configurado pelo Spring Boot via {@code spring.mail.*}
     * — este bean centraliza as propriedades customizadas do HERMES e garante
     * que o sender esteja disponível para injeção com qualificação explícita
     * se necessário.</p>
     *
     * <p>A instância retornada já possui SMTP host, porta, credenciais e
     * configurações de TLS/STARTTLS aplicadas pela auto-configuração do Spring.</p>
     *
     * @return o {@link JavaMailSender} configurado e pronto para uso
     */
    @Bean
    public JavaMailSender javaMailSender() {
        log.info("JavaMailSender configurado — remetente: {}", getFormattedSender());
        return autoConfiguredMailSender;
    }

    /**
     * Retorna o endereço de e-mail do remetente.
     *
     * <p>Utilizado pelo {@code EmailService} para preencher o campo {@code From}
     * dos e-mails enviados pelo HERMES.</p>
     *
     * @return endereço de e-mail do remetente (ex: {@code noreply@hermes.com})
     */
    public String getMailFrom() {
        return mailFrom;
    }

    /**
     * Retorna o nome de exibição do remetente.
     *
     * <p>Combinado com {@link #getMailFrom()} pelo método {@link #getFormattedSender()}
     * para montar o header {@code From} no formato RFC 5322.</p>
     *
     * @return nome de exibição (ex: {@code HERMES Notificações})
     */
    public String getMailFromName() {
        return mailFromName;
    }

    /**
     * Retorna o tamanho máximo de anexos em bytes.
     *
     * <p>O {@code EmailService} deve validar o tamanho de cada anexo antes do envio.
     * Se o total de anexos exceder este limite, a notificação deve ser rejeitada
     * com erro de validação ({@code 400 Bad Request}).</p>
     *
     * @return tamanho máximo em bytes (padrão: 10.485.760 = 10 MB)
     */
    public long getMaxSizeBytes() {
        return maxSizeBytes;
    }

    /**
     * Formata o remetente no padrão RFC 5322: {@code "Nome <email>"}.
     *
     * <p>Este formato é reconhecido por todos os clientes de e-mail modernos
     * e exibe o nome amigável no campo "De:" em vez do endereço bruto.</p>
     *
     * <p><b>Exemplo de saída:</b> {@code HERMES Notificações <noreply@hermes.com>}</p>
     *
     * <p><b>Uso no EmailService:</b></p>
     * <pre>
     * MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
     * helper.setFrom(mailConfig.getFormattedSender());
     * </pre>
     *
     * @return string no formato {@code "Nome <email>"} pronta para uso como header From
     */
    public String getFormattedSender() {
        return String.format("%s <%s>", mailFromName, mailFrom);
    }
}