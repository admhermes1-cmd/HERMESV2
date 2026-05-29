package com.hermes.controller;

import com.hermes.dto.notification.BulkNotificationResultDTO;
import com.hermes.entity.User;
import com.hermes.exception.AppException;
import com.hermes.security.JwtUtil;
import com.hermes.service.BulkNotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Controller REST para operações de envio em massa de notificações.
 *
 * <p>Expõe o endpoint {@code POST /notifications/bulk} que aceita um arquivo
 * CSV ou JSON contendo a lista de destinatários e os valores das variáveis
 * do template selecionado.</p>
 *
 * <p>O processamento é delegado integralmente ao {@link BulkNotificationService},
 * que por sua vez reutiliza o {@code NotificationService} existente para cada
 * envio individual — sem duplicar nenhuma lógica de SMTP ou template.</p>
 *
 * <p><b>Autenticação:</b> exige JWT válido. Segue a regra
 * {@code /notifications/**} → {@code authenticated()} definida no
 * {@code SecurityConfig}. O UUID do usuário é extraído pelo mesmo padrão
 * de {@link NotificationController#getAuthenticatedUserId}.</p>
 *
 * @see BulkNotificationService
 * @see NotificationController
 */
@Slf4j
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Validated
@Tag(name = "Notificações em Massa", description = "Envio em massa de notificações via CSV ou JSON")
public class BulkNotificationController {

    private final BulkNotificationService bulkNotificationService;
    private final JwtUtil jwtUtil;

    /**
     * Processa um arquivo CSV ou JSON e envia notificações individuais para cada
     * destinatário listado, reutilizando o fluxo de envio já existente no sistema.
     *
     * <p><b>Formato CSV:</b></p>
     * <pre>
     * email,nome,empresa
     * joao@exemplo.com,João Silva,Acme Corp
     * </pre>
     *
     * <p><b>Formato JSON:</b></p>
     * <pre>
     * [{"email": "joao@exemplo.com", "nome": "João Silva", "empresa": "Acme Corp"}]
     * </pre>
     *
     * <p>A coluna {@code email} é sempre obrigatória. As demais colunas devem
     * corresponder às variáveis declaradas na versão do template selecionado.
     * O envio é processado linha a linha — falhas individuais são registradas
     * no resultado sem interromper as demais.</p>
     *
     * @param templateId        UUID do template a ser utilizado em todos os envios
     * @param templateVersionId UUID da versão específica do template; se omitido, usa a versão ativa mais recente
     * @param channel           canal de envio correspondente ao template (ex: {@code EMAIL})
     * @param scheduledAt       data/hora de agendamento no formato ISO-8601 com offset; se omitido, envio imediato
     * @param file              arquivo CSV ou JSON com os destinatários (máx. 5 MB, 200 registros)
     * @return {@link BulkNotificationResultDTO} com totais e detalhes de sucesso/falha por linha
     */
    @PostMapping(value = "/bulk", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary     = "Envio em massa via CSV ou JSON",
            description = "Processa um arquivo com múltiplos destinatários e envia notificações individuais "
                        + "para cada um, reutilizando o fluxo de envio existente. "
                        + "Limite: 200 destinatários por arquivo, 5 MB."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200",
                    description = "Processamento concluído — verifique successes e failures no corpo",
                    content = @Content(schema = @Schema(implementation = BulkNotificationResultDTO.class))),
            @ApiResponse(responseCode = "400",
                    description = "Arquivo inválido, vazio, muito grande ou excede o limite de registros",
                    content = @Content),
            @ApiResponse(responseCode = "401",
                    description = "Token JWT ausente ou inválido",
                    content = @Content),
            @ApiResponse(responseCode = "404",
                    description = "Template ou versão não encontrado",
                    content = @Content)
    })
    public ResponseEntity<BulkNotificationResultDTO> sendBulk(
            @Parameter(description = "UUID do template a ser utilizado", required = true)
            @RequestParam UUID templateId,

            @Parameter(description = "UUID da versão do template; se omitido, usa a versão ativa mais recente")
            @RequestParam(required = false) UUID templateVersionId,

            @Parameter(description = "Canal de envio correspondente ao template (ex: EMAIL)", required = true)
            @RequestParam String channel,

            @Parameter(description = "Data/hora de agendamento (ISO-8601 com offset). Omita para envio imediato.")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            OffsetDateTime scheduledAt,

            @Parameter(description = "Arquivo CSV ou JSON com os destinatários (máx. 5 MB, 200 registros)", required = true)
            @RequestParam MultipartFile file
    ) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID createdBy = getAuthenticatedUserId(auth);

        log.info("[BulkNotificationController] Envio em massa recebido: templateId={}, channel={}, file={}, size={} bytes, user={}",
                templateId, channel, file.getOriginalFilename(), file.getSize(), createdBy);

        BulkNotificationResultDTO result = bulkNotificationService.processBulkNotification(
                templateId,
                templateVersionId,
                channel,
                scheduledAt,
                file,
                createdBy
        );

        return ResponseEntity.ok(result);
    }

    /**
     * Extrai o UUID do usuário autenticado a partir do {@link Authentication}.
     *
     * <p>Replica o mesmo padrão de {@code NotificationController}: tenta primeiro
     * o principal como entidade {@link User}; se não for possível, extrai o UUID
     * das credenciais via {@link JwtUtil#extractUserId}.</p>
     *
     * @param auth objeto de autenticação do Spring Security
     * @return UUID do usuário autenticado
     * @throws AppException 401 se não for possível identificar o usuário
     */
    private UUID getAuthenticatedUserId(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw AppException.unauthorized(AppException.ErrorCode.AUTH_INVALID_CREDENTIALS,
                    "Usuário não autenticado");
        }

        if (auth.getPrincipal() instanceof User user) {
            return user.getId();
        }

        if (auth.getCredentials() != null) {
            return jwtUtil.extractUserId(auth.getCredentials().toString());
        }

        throw AppException.unauthorized(AppException.ErrorCode.AUTH_INVALID_CREDENTIALS,
                "Não foi possível extrair o usuário autenticado.");
    }
}