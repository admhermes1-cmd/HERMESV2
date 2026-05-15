package com.hermes.exception;

import com.hermes.exception.AppException.ErrorCode;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;

/**
 * DTO imutável que representa o corpo padronizado de respostas de erro da API HERMES.
 *
 * <p>Implementado como Java Record para garantir imutabilidade e eliminar boilerplate.
 * É o único formato de erro que atravessa a fronteira HTTP — nunca expõe internals Java.</p>
 *
 * <p>Shape esperado pelo frontend (AppError contract):</p>
 * <pre>{@code
 * {
 *   "status":    404,
 *   "code":      "TEMPLATE_NOT_FOUND",
 *   "message":   "Template não encontrado",
 *   "details":   "Nenhum template com id 'abc-123' foi encontrado",
 *   "timestamp": "2026-04-10T14:32:00",
 *   "path":      "/templates/abc-123"
 * }
 * }</pre>
 *
 * @param status    código HTTP numérico da resposta
 * @param code      código semântico de erro (ver {@link ErrorCode})
 * @param message   mensagem curta e amigável em português para o usuário final
 * @param details   detalhes adicionais visíveis apenas para admins; {@code null} quando não aplicável
 * @param timestamp momento exato em que o erro foi gerado no servidor
 * @param path      URI da requisição que originou o erro
 */
public record ErrorResponseDTO(
        int status,
        String code,
        String message,
        String details,
        LocalDateTime timestamp,
        String path
) {

    // -------------------------------------------------------------------------
    // Factory methods
    // -------------------------------------------------------------------------

    /**
     * Cria um {@code ErrorResponseDTO} a partir de uma {@link AppException} de domínio.
     *
     * <p>Mapeia diretamente os campos tipados da exceção, garantindo consistência
     * entre o que foi lançado pelo service e o que chega ao cliente.</p>
     *
     * @param ex   exceção de domínio contendo status HTTP, código semântico e mensagem amigável
     * @param path URI da requisição que gerou o erro (extraída do {@code HttpServletRequest})
     * @return instância preenchida, pronta para serialização JSON
     */
    public static ErrorResponseDTO from(AppException ex, String path) {
        return new ErrorResponseDTO(
                ex.getHttpStatus().value(),
                ex.getCode(),
                ex.getMessage(),
                ex.getDetails(),
                LocalDateTime.now(),
                path
        );
    }

    /**
     * Cria um {@code ErrorResponseDTO} genérico para erros inesperados (catch-all 500).
     *
     * <p><strong>Segurança:</strong> propositalmente omite qualquer detalhe interno.
     * Stack traces e mensagens de exceção devem estar apenas nos logs do servidor,
     * jamais na resposta HTTP.</p>
     *
     * @param path URI da requisição que gerou o erro
     * @return instância com mensagem genérica e status 500
     */
    public static ErrorResponseDTO internal(String path) {
        return new ErrorResponseDTO(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                ErrorCode.INTERNAL_SERVER_ERROR.name(),
                "Erro interno do servidor",
                null,
                LocalDateTime.now(),
                path
        );
    }

    /**
     * Cria um {@code ErrorResponseDTO} para falhas de validação Bean Validation.
     *
     * <p>O campo {@code details} agrega os erros de todos os campos inválidos no formato
     * {@code "campo: mensagem; campo2: mensagem2"}, permitindo que o frontend mapeie
     * erros de forma programática quando necessário.</p>
     *
     * @param details descrição concatenada dos campos inválidos e suas restrições violadas
     * @param path    URI da requisição que gerou o erro
     * @return instância com status 400 e code {@code VALIDATION_ERROR}
     */
    public static ErrorResponseDTO validation(String details, String path) {
        return new ErrorResponseDTO(
                HttpStatus.BAD_REQUEST.value(),
                ErrorCode.VALIDATION_ERROR.name(),
                "Erro de validação",
                details,
                LocalDateTime.now(),
                path
        );
    }
}