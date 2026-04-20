package com.hermes.exception;

import com.hermes.exception.AppException.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

/**
 * Handler global de exceções do HERMES.
 *
 * <p>Centraliza o tratamento de todos os erros que escapam dos controllers,
 * garantindo que:</p>
 * <ul>
 *   <li>Toda resposta de erro siga o contrato {@link ErrorResponseDTO};</li>
 *   <li>Stack traces e mensagens internas sejam logados mas nunca expostos ao cliente;</li>
 *   <li>Cada categoria de erro produza o status HTTP e código semântico corretos.</li>
 * </ul>
 *
 * <p>Ordem de precedência dos handlers: Spring prioriza o handler mais específico.
 * O catch-all {@link #handleUnexpected} só é acionado quando nenhum outro handler se aplica.</p>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // -------------------------------------------------------------------------
    // Exceções de domínio
    // -------------------------------------------------------------------------

    /**
     * Trata exceções de domínio lançadas pelos services.
     *
     * <p>Loga os detalhes técnicos em nível WARN (não é erro inesperado, é fluxo de negócio)
     * e retorna ao cliente apenas a mensagem amigável já sanitizada.</p>
     *
     * @param ex      exceção de domínio com status HTTP, código semântico e mensagem amigável
     * @param request requisição HTTP corrente, usada para extrair o URI no corpo da resposta
     * @return resposta HTTP com status e corpo padronizados
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponseDTO> handleAppException(
            AppException ex, HttpServletRequest request) {

        log.warn("AppException [{}] {}: {}", ex.getCode(), ex.getMessage(), ex.getDetails());

        return ResponseEntity
                .status(ex.getHttpStatus())
                .body(ErrorResponseDTO.from(ex, request.getRequestURI()));
    }

    // -------------------------------------------------------------------------
    // Validação — Bean Validation (body)
    // -------------------------------------------------------------------------

    /**
     * Trata falhas de validação em request bodies anotados com {@code @Valid} ou {@code @Validated}.
     *
     * <p>Agrega todos os erros de campo em uma única string delimitada por ponto-e-vírgula,
     * permitindo que o frontend mapeie os erros de forma granular se necessário.</p>
     *
     * @param ex      exceção com os resultados de binding e validação
     * @param request requisição HTTP corrente
     * @return {@code 400 BAD REQUEST} com detalhes dos campos inválidos
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponseDTO> handleValidationException(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));

        log.warn("Validation error on {}: {}", request.getRequestURI(), details);

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponseDTO.validation(details, request.getRequestURI()));
    }

    // -------------------------------------------------------------------------
    // Validação — Bean Validation (path/query params)
    // -------------------------------------------------------------------------

    /**
     * Trata violações de constraints em parâmetros de path e query ({@code @RequestParam},
     * {@code @PathVariable}) quando a classe/método usa {@code @Validated}.
     *
     * @param ex      exceção com o conjunto de violações de constraint
     * @param request requisição HTTP corrente
     * @return {@code 400 BAD REQUEST} com detalhes das violações
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponseDTO> handleConstraintViolation(
            ConstraintViolationException ex, HttpServletRequest request) {

        String details = ex.getConstraintViolations().stream()
                .map(v -> {
                    // Remove o prefixo do nome do método para expor apenas o nome do parâmetro
                    String propertyPath = v.getPropertyPath().toString();
                    String field = propertyPath.contains(".")
                            ? propertyPath.substring(propertyPath.lastIndexOf('.') + 1)
                            : propertyPath;
                    return field + ": " + v.getMessage();
                })
                .collect(Collectors.joining("; "));

        log.warn("Constraint violation on {}: {}", request.getRequestURI(), details);

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponseDTO.validation(details, request.getRequestURI()));
    }

    // -------------------------------------------------------------------------
    // Rota não encontrada
    // -------------------------------------------------------------------------

    /**
     * Trata requisições para rotas inexistentes no contexto da aplicação.
     *
     * <p>Cobre tanto o Spring MVC clássico ({@link NoHandlerFoundException})
     * quanto o Spring WebMVC moderno ({@link NoResourceFoundException}).</p>
     *
     * @param ex      exceção de rota não encontrada
     * @param request requisição HTTP corrente
     * @return {@code 404 NOT FOUND} com código {@code RESOURCE_NOT_FOUND}
     */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorResponseDTO> handleNotFound(
            Exception ex, HttpServletRequest request) {

        log.warn("Route not found: {} {}", request.getMethod(), request.getRequestURI());

        AppException appEx = AppException.notFound(
                ErrorCode.RESOURCE_NOT_FOUND,
                "Recurso não encontrado"
        );

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ErrorResponseDTO.from(appEx, request.getRequestURI()));
    }

    // -------------------------------------------------------------------------
    // Método HTTP não suportado
    // -------------------------------------------------------------------------

    /**
     * Trata requisições que utilizam um método HTTP não suportado pelo endpoint.
     *
     * <p>Exemplo: {@code DELETE /templates} quando o endpoint aceita apenas {@code GET} e {@code POST}.</p>
     *
     * @param ex      exceção com o método utilizado e os métodos aceitos
     * @param request requisição HTTP corrente
     * @return {@code 405 METHOD NOT ALLOWED}
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponseDTO> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {

        String supported = ex.getSupportedHttpMethods() != null
                ? ex.getSupportedHttpMethods().toString()
                : "desconhecido";

        log.warn("Method not allowed on {}: used={} supported={}",
                request.getRequestURI(), ex.getMethod(), supported);

        AppException appEx = new AppException(
                HttpStatus.METHOD_NOT_ALLOWED,
                ErrorCode.VALIDATION_ERROR,
                "Método HTTP não suportado para este recurso",
                "Método utilizado: " + ex.getMethod() + " | Métodos aceitos: " + supported
        );

        return ResponseEntity
                .status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ErrorResponseDTO.from(appEx, request.getRequestURI()));
    }

    // -------------------------------------------------------------------------
    // Upload excede limite configurado
    // -------------------------------------------------------------------------

    /**
     * Trata uploads que ultrapassam o limite máximo configurado no Spring
     * ({@code spring.servlet.multipart.max-file-size} / {@code max-request-size}).
     *
     * <p>Mapeia para o código de domínio {@code NOTIFICATION_INVALID_SIZE} pois,
     * no contexto do HERMES, uploads só ocorrem no envio de notificações.</p>
     *
     * @param ex      exceção de tamanho excedido
     * @param request requisição HTTP corrente
     * @return {@code 400 BAD REQUEST} com código {@code NOTIFICATION_INVALID_SIZE}
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponseDTO> handleMaxUploadSize(
            MaxUploadSizeExceededException ex, HttpServletRequest request) {

        log.warn("Upload size exceeded on {}: {}", request.getRequestURI(), ex.getMessage());

        AppException appEx = AppException.badRequest(
                ErrorCode.NOTIFICATION_INVALID_SIZE,
                "Tamanho total excede o limite de 10MB"
        );

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponseDTO.from(appEx, request.getRequestURI()));
    }

    // -------------------------------------------------------------------------
    // Catch-all — exceções não tratadas
    // -------------------------------------------------------------------------

    /**
     * Captura qualquer exceção não tratada pelos handlers anteriores.
     *
     * <p><strong>Contrato de segurança:</strong> este handler <em>nunca</em> expõe
     * {@code ex.getMessage()}, nome de classe, stack trace ou qualquer detalhe interno
     * na resposta HTTP. Toda essa informação é logada em nível ERROR para diagnóstico
     * pelo time de operações.</p>
     *
     * <p>O cliente recebe apenas uma mensagem genérica com status 500.</p>
     *
     * @param ex      exceção não esperada capturada pelo advice
     * @param request requisição HTTP corrente
     * @return {@code 500 INTERNAL SERVER ERROR} com mensagem genérica
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDTO> handleUnexpected(
            Exception ex, HttpServletRequest request) {

        // Stack trace completo nos logs — nunca na resposta HTTP
        log.error("Unexpected error on {} {}: ",
                request.getMethod(), request.getRequestURI(), ex);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponseDTO.internal(request.getRequestURI()));
    }
}