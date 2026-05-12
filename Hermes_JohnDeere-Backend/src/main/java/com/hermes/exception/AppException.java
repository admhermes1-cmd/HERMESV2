package com.hermes.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Exceção de domínio central do HERMES.
 *
 * <p>Toda exceção de regra de negócio deve ser lançada como {@code AppException},
 * garantindo que o {@link GlobalExceptionHandler} consiga produzi uma resposta HTTP
 * padronizada, segura e rastreável.</p>
 *
 * <p>Uso recomendado via factory methods estáticos nos services:</p>
 * <pre>{@code
 * // Simples — sem detalhes técnicos adicionais
 * throw AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND, "Template não encontrado");
 *
 * // Com detalhes técnicos para os logs (nunca retornados ao cliente)
 * throw AppException.internal(
 *     ErrorCode.NOTIFICATION_SEND_FAILED,
 *     "Falha ao enviar a notificação",
 *     "SMTP error: " + e.getMessage()
 * );
 * }</pre>
 */
@Getter
public class AppException extends RuntimeException {

    /**
     * Cria uma exceção indicando que o usuário solicitado não foi encontrado.
     *
     * @return {@link AppException} com código {@code USER_NOT_FOUND} (404).
     */
    public static AppException userNotFound() {
        return new AppException(ErrorCode.USER_NOT_FOUND);
    }

    /**
     * Cria uma exceção indicando que o e-mail já está em uso por outro usuário.
     *
     * @return {@link AppException} com código {@code USER_EMAIL_DUPLICATE} (409).
     */
    public static AppException userEmailDuplicate() {
        return new AppException(ErrorCode.USER_EMAIL_DUPLICATE);
    }

    /**
     * Cria uma exceção indicando tentativa de alteração do e-mail após criação.
     *
     * @return {@link AppException} com código {@code USER_EMAIL_IMMUTABLE} (400).
     */
    public static AppException userEmailImmutable() {
        return new AppException(ErrorCode.USER_EMAIL_IMMUTABLE);
    }

    /**
     * Cria exceção com lista de violações de política de senha.
     *
     * @param violations lista de mensagens descrevendo cada violação.
     * @return {@link AppException} com código {@code PASSWORD_POLICY_VIOLATION} (400).
     */
    public static AppException passwordPolicyViolation(List<String> violations) {
        String detail = String.join(" | ", violations);

        return new AppException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.PASSWORD_POLICY_VIOLATION,
                ErrorCode.PASSWORD_POLICY_VIOLATION.getDefaultMessage(),
                detail
        );
    }

    /**
     * Cria exceção indicando que a senha atual informada está incorreta.
     *
     * @return {@link AppException} com código {@code PASSWORD_CURRENT_INCORRECT} (400).
     */
    public static AppException passwordCurrentIncorrect() {
        return new AppException(ErrorCode.PASSWORD_CURRENT_INCORRECT);
    }

    /**
     * Cria uma exceção indicando que o admin tentou excluir a própria conta.
     *
     * @return {@link AppException} com código {@code USER_CANNOT_DELETE_SELF} (409).
     */
    public static AppException userCannotDeleteSelf() {
        return new AppException(ErrorCode.USER_CANNOT_DELETE_SELF);
    }

    /** Status HTTP que será usado na resposta ao cliente. */
    private final HttpStatus httpStatus;

    /**
     * Código semântico de erro como string (nome do enum {@link ErrorCode}).
     * Serializado diretamente no JSON de resposta.
     */
    private final String code;

    /**
     * Mensagem curta e amigável em português destinada ao usuário final.
     * Deve ser genérica o suficiente para não vazar detalhes de implementação.
     */
    private final String message;

    /**
     * Detalhes técnicos para diagnóstico e logs.
     * <strong>Nunca</strong> incluído na resposta HTTP ao cliente.
     * Pode ser {@code null} quando a mensagem já é suficiente.
     */
    private final String details;

    // -------------------------------------------------------------------------
    // Construtores
    // -------------------------------------------------------------------------

    /**
     * Construtor completo com todos os campos.
     *
     * @param httpStatus status HTTP da resposta (ex: {@code HttpStatus.NOT_FOUND})
     * @param code       código semântico do enum {@link ErrorCode}
     * @param message    mensagem amigável para o usuário final em português
     * @param details    detalhes técnicos para logs; pode ser {@code null}
     */
    public AppException(HttpStatus httpStatus, ErrorCode code, String message, String details) {
        super(message);
        this.httpStatus = httpStatus;
        this.code = code.name();
        this.message = message;
        this.details = details;
    }

    /**
     * Construtor sem detalhes técnicos — para erros onde a mensagem já é suficiente.
     *
     * @param httpStatus status HTTP da resposta
     * @param code       código semântico do enum {@link ErrorCode}
     * @param message    mensagem amigável para o usuário final em português
     */
    public AppException(HttpStatus httpStatus, ErrorCode code, String message) {
        this(httpStatus, code, message, null);
    }

    /**
     * Construtor a partir de um {@link ErrorCode} com httpStatus e defaultMessage embutidos.
     *
     * @param code código semântico do enum {@link ErrorCode}
     */
    public AppException(ErrorCode code) {
        this(
                HttpStatus.resolve(code.getHttpStatus()) != null
                        ? HttpStatus.resolve(code.getHttpStatus())
                        : HttpStatus.INTERNAL_SERVER_ERROR,
                code,
                code.getDefaultMessage(),
                null
        );
    }

    // -------------------------------------------------------------------------
    // Factory methods — reduzem verbosidade nos services
    // -------------------------------------------------------------------------

    /**
     * Cria uma {@code AppException} com status {@code 404 NOT FOUND}.
     *
     * @param code    código semântico do erro
     * @param message mensagem amigável para o usuário
     * @return instância configurada
     */
    public static AppException notFound(ErrorCode code, String message) {
        return new AppException(HttpStatus.NOT_FOUND, code, message);
    }

    /**
     * Cria uma {@code AppException} com status {@code 409 CONFLICT}.
     *
     * @param code    código semântico do erro
     * @param message mensagem amigável para o usuário
     * @return instância configurada
     */
    public static AppException conflict(ErrorCode code, String message) {
        return new AppException(HttpStatus.CONFLICT, code, message);
    }

    /**
     * Cria uma {@code AppException} com status {@code 400 BAD REQUEST}.
     *
     * @param code    código semântico do erro
     * @param message mensagem amigável para o usuário
     * @return instância configurada
     */
    public static AppException badRequest(ErrorCode code, String message) {
        return new AppException(HttpStatus.BAD_REQUEST, code, message);
    }

    /**
     * Cria uma {@code AppException} com status {@code 401 UNAUTHORIZED}.
     *
     * @param code    código semântico do erro
     * @param message mensagem amigável para o usuário
     * @return instância configurada
     */
    public static AppException unauthorized(ErrorCode code, String message) {
        return new AppException(HttpStatus.UNAUTHORIZED, code, message);
    }

    /**
     * Cria uma {@code AppException} com status {@code 403 FORBIDDEN}.
     *
     * @param code    código semântico do erro
     * @param message mensagem amigável para o usuário
     * @return instância configurada
     */
    public static AppException forbidden(ErrorCode code, String message) {
        return new AppException(HttpStatus.FORBIDDEN, code, message);
    }

    /**
     * Cria uma {@code AppException} com status {@code 500 INTERNAL SERVER ERROR}.
     *
     * <p>Deve ser usado quando a falha é causada por um sistema externo
     * (SMTP, SMS gateway, etc.) e os detalhes técnicos precisam ser
     * preservados nos logs sem vazar ao cliente.</p>
     *
     * @param code    código semântico do erro
     * @param message mensagem amigável para o usuário
     * @param details detalhes técnicos para diagnóstico
     * @return instância configurada
     */
    public static AppException internal(ErrorCode code, String message, String details) {
        return new AppException(HttpStatus.INTERNAL_SERVER_ERROR, code, message, details);
    }

    // -------------------------------------------------------------------------
    // Enum de códigos de erro
    // -------------------------------------------------------------------------

    /**
      * Enumeração tipada de todos os códigos de erro semânticos do HERMES.
     *
     * <p>Organizado por domínio para facilitar navegação e manutenção.
     * O nome de cada constante é serializado diretamente no campo {@code code} do JSON de resposta,
     * seguindo o contrato com o frontend.</p>
      */
    public enum ErrorCode {

        // ------------------------------------------------------------------
        // Auth — autenticação e autorização
        // ------------------------------------------------------------------

         /** Credenciais (usuário/senha) fornecidas estão incorretas. */
        AUTH_INVALID_CREDENTIALS,
        /** O JWT informado está expirado e não pode mais ser aceito. */
        AUTH_TOKEN_EXPIRED,
        /** O JWT informado é malformado, adulterado ou de assinatura inválida. */
        AUTH_TOKEN_INVALID,
        /** O usuário autenticado não possui a role necessária para o recurso. */
        AUTH_INSUFFICIENT_ROLE,
        /** O usuário existe mas está marcado como inativo no sistema. */
        AUTH_USER_INACTIVE,

        // ------------------------------------------------------------------
        // Template — gestão de templates de notificação
        // ------------------------------------------------------------------

        /** Nenhum template com o identificador informado foi encontrado. */
        TEMPLATE_NOT_FOUND,
        /** Já existe um template cadastrado com o mesmo nome. */
        TEMPLATE_NAME_DUPLICATE,
        /** Tentativa de alterar o canal de um template já criado (operação proibida). */
        TEMPLATE_CHANNEL_IMMUTABLE,
        /** Template não pode ser excluído pois possui notificações vinculadas. */
        TEMPLATE_HAS_NOTIFICATIONS,
        /** Versão específica do template não foi encontrada. */
        TEMPLATE_VERSION_NOT_FOUND,
        /** O template já atingiu o número máximo de versões permitidas. */
        TEMPLATE_MAX_VERSIONS,

        // ------------------------------------------------------------------
        // Notification — envio de notificações
        // ------------------------------------------------------------------

        /** Nenhuma notificação com o identificador informado foi encontrada. */
        NOTIFICATION_NOT_FOUND,
        /** O tamanho total dos anexos/payload excede o limite de 10 MB. */
        NOTIFICATION_INVALID_SIZE,
        /** O endereço de e-mail do destinatário não é válido. */
        NOTIFICATION_INVALID_EMAIL,
        /** A notificação não pode ser cancelada pois já foi enviada ou está em processamento. */
        NOTIFICATION_CANNOT_CANCEL,
        /** A notificação não pode ser retentada no estado atual. */
        NOTIFICATION_CANNOT_RETRY,
        /** Falha na integração com o canal de envio (SMTP, SMS gateway, etc.). */
        NOTIFICATION_SEND_FAILED,

        // ------------------------------------------------------------------
        // Scheduled — agendamento de notificações
        // ------------------------------------------------------------------

        /** Nenhum agendamento com o identificador informado foi encontrado. */
        SCHEDULED_NOT_FOUND,
        /** A data/hora de agendamento informada é anterior ao momento atual. */
        SCHEDULED_PAST_DATE,
        /** O agendamento não respeita a antecedência mínima exigida pelo sistema. */
        SCHEDULED_MIN_ADVANCE,
        /** A data de agendamento informada não é válida. */
        NOTIFICATION_INVALID_SCHEDULED_AT,

        // ------------------------------------------------------------------
        // Genérico
        // ------------------------------------------------------------------

        /** Um ou mais campos da requisição falharam na validação Bean Validation. */
        VALIDATION_ERROR,
        /** Erro interno não esperado; detalhes disponíveis apenas nos logs do servidor. */
        INTERNAL_SERVER_ERROR,
        /** O recurso solicitado não existe ou a rota não foi encontrada. */
        RESOURCE_NOT_FOUND,

        // ------------------------------------------------------------------
        // Usuários / Senhas
        // ------------------------------------------------------------------

        USER_NOT_FOUND(404, "Usuário não encontrado"),
        USER_EMAIL_DUPLICATE(409, "Já existe um usuário com este e-mail"),
        USER_EMAIL_IMMUTABLE(400, "O e-mail não pode ser alterado após a criação"),
        USER_CANNOT_DELETE_SELF(409, "Você não pode excluir sua própria conta"),

        PASSWORD_POLICY_VIOLATION(400, "A senha não cumpre os requisitos de segurança"),
        PASSWORD_CURRENT_INCORRECT(400, "A senha inserida no campo \"Senha temporária\" está incorreta"),

        USER_SEND_EMAIL_FAILED(500, "Falha ao enviar e-mail de boas-vindas");

        private final int httpStatus;
        private final String defaultMessage;

        ErrorCode() {
            this.httpStatus = 0;
            this.defaultMessage = "";
        }

        ErrorCode(int httpStatus, String defaultMessage) {
            this.httpStatus = httpStatus;
            this.defaultMessage = defaultMessage;
        }

        public int getHttpStatus() {
            return httpStatus;
        }

        public String getDefaultMessage() {
            return defaultMessage;
        }
    }
}