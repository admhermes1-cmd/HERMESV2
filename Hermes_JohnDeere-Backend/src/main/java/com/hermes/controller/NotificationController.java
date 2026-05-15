package com.hermes.controller;

import com.hermes.dto.notification.NotificationRequestDTO;
import com.hermes.dto.notification.NotificationResponseDTO;
import com.hermes.dto.PageResponseDTO;
import com.hermes.entity.User;
import com.hermes.entity.enums.NotificationChannel;
import com.hermes.entity.enums.NotificationStatus;
import com.hermes.exception.AppException;
import com.hermes.security.JwtUtil;
import com.hermes.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Controller responsável pelo envio e gerenciamento de notificações no HERMES.
 * <p>
 * Permite criar, listar, consultar, cancelar e retentar notificações.
 * O endpoint de criação suporta {@code multipart/form-data} para anexos opcionais,
 * como arquivos PDF ou imagens vinculadas ao envio.
 * </p>
 *
 * @author HERMES Team
 */
@Slf4j
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Validated
@Tag(name = "Notificações", description = "Envio e agendamento de comunicações")
public class NotificationController {

    private final NotificationService notificationService;
    private final JwtUtil jwtUtil;

    /**
     * Lista notificações com filtros opcionais de status e canal, com paginação.
     *
     * @param status  filtro opcional pelo status da notificação (ex.: PENDING, SENT, FAILED)
     * @param channel filtro opcional pelo canal de comunicação (ex.: EMAIL, SMS, WHATSAPP)
     * @param page    número da página, 1-based (padrão: 1)
     * @param limit   quantidade de itens por página (padrão: 10)
     * @return página de {@link NotificationResponseDTO} com metadados de paginação
     */
    @GetMapping
    @Operation(
            summary = "Listar notificações",
            description = "Retorna uma lista paginada de notificações, com filtros opcionais por status e canal."
    )
    @ApiResponse(responseCode = "200", description = "Lista de notificações retornada com sucesso")
    public ResponseEntity<PageResponseDTO<NotificationResponseDTO>> listNotifications(
            @Parameter(description = "Status da notificação: PENDING, SENT, FAILED, CANCELLED, SCHEDULED")
            @RequestParam(required = false) String status,
            @Parameter(description = "Canal de comunicação: EMAIL, SMS, WHATSAPP, etc.")
            @RequestParam(required = false) String channel,
            @Parameter(description = "Número da página (1-based)")
            @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Quantidade de itens por página")
            @RequestParam(defaultValue = "10") int limit) {

        NotificationStatus notificationStatus = (status != null)
                ? NotificationStatus.valueOf(status.toUpperCase())
                : null;

        NotificationChannel notificationChannel = (channel != null)
                ? NotificationChannel.valueOf(channel.toUpperCase())
                : null;

        PageResponseDTO<NotificationResponseDTO> result =
                notificationService.listNotifications(notificationStatus, notificationChannel, page, limit);

        return ResponseEntity.ok(result);
    }

    /**
     * Busca uma notificação específica pelo seu identificador único.
     *
     * @param id UUID da notificação
     * @return {@link NotificationResponseDTO} com os dados completos da notificação
     */
    @GetMapping("/{id}")
    @Operation(
            summary = "Buscar notificação por ID",
            description = "Retorna os dados completos de uma notificação específica, incluindo seu status atual."
    )
    @ApiResponse(responseCode = "200", description = "Notificação encontrada")
    @ApiResponse(responseCode = "404", description = "Notificação não encontrada")
    public ResponseEntity<NotificationResponseDTO> getNotification(
            @Parameter(description = "UUID da notificação") @PathVariable UUID id) {

        NotificationResponseDTO notification = notificationService.getNotification(id);
        return ResponseEntity.ok(notification);
    }

    /**
     * Cria e processa uma nova notificação.
     * <p>
     * Aceita {@code multipart/form-data} para suporte a anexos. O campo
     * {@code request} deve ser um JSON serializado como parte do multipart,
     * e os arquivos devem ser enviados no campo {@code attachments}.
     * </p>
     * <p>
     * O UUID do criador é extraído automaticamente do token JWT da requisição,
     * evitando uma consulta adicional ao banco de dados.
     * </p>
     *
     * @param request     dados da notificação a ser criada e/ou agendada
     * @param attachments lista opcional de arquivos a serem anexados ao envio
     * @return {@link NotificationResponseDTO} da notificação criada, com status 201
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Enviar ou agendar notificação",
            description = "Cria uma notificação imediata ou agendada. Suporta anexos via multipart/form-data. "
                        + "O campo 'request' é o JSON da notificação; 'attachments' são arquivos opcionais."
    )
    @ApiResponse(responseCode = "201", description = "Notificação criada com sucesso")
    @ApiResponse(responseCode = "400", description = "Dados inválidos ou template inexistente")
    public ResponseEntity<NotificationResponseDTO> createNotification(
            @Parameter(description = "JSON com os dados da notificação")
            @RequestPart("request") @Valid NotificationRequestDTO request,
            @Parameter(description = "Arquivos anexos (opcional)")
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID createdBy = getAuthenticatedUserId(auth);

        log.info("Criando notificação pelo usuário: {} | canal: {} | agendada: {}",
                createdBy, request.getChannel(), request.getScheduledAt() != null);

        NotificationResponseDTO created = notificationService.createNotification(request, attachments, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Cancela uma notificação agendada que ainda não foi processada.
     * <p>
     * Apenas notificações no status {@code SCHEDULED} ou {@code PENDING} podem
     * ser canceladas. Para outros estados, o serviço lança uma exceção 409.
     * </p>
     *
     * @param id UUID da notificação a ser cancelada
     * @return {@link NotificationResponseDTO} com o status atualizado para CANCELLED
     */
    @PostMapping("/{id}/cancel")
    @Operation(
            summary = "Cancelar notificação agendada",
            description = "Cancela uma notificação que ainda não foi enviada. "
                        + "Apenas notificações com status SCHEDULED ou PENDING podem ser canceladas."
    )
    @ApiResponse(responseCode = "200", description = "Notificação cancelada com sucesso")
    @ApiResponse(responseCode = "404", description = "Notificação não encontrada")
    @ApiResponse(responseCode = "409", description = "Notificação não pode ser cancelada no status atual")
    public ResponseEntity<NotificationResponseDTO> cancelNotification(
            @Parameter(description = "UUID da notificação") @PathVariable UUID id) {

        log.info("Cancelando notificação: {}", id);

        NotificationResponseDTO cancelled = notificationService.cancelNotification(id);
        return ResponseEntity.ok(cancelled);
    }

    /**
     * Reprocessa uma notificação que falhou durante o envio.
     * <p>
     * Apenas notificações no status {@code FAILED} podem ser retentadas.
     * Para outros estados, o serviço lança uma exceção 409.
     * </p>
     *
     * @param id UUID da notificação a ser retentada
     * @return {@link NotificationResponseDTO} com o status atualizado para PENDING
     */
    @PostMapping("/{id}/retry")
    @Operation(
            summary = "Retentar envio de notificação com falha",
            description = "Agenda uma nova tentativa de envio para notificações com status FAILED."
    )
    @ApiResponse(responseCode = "200", description = "Retentativa iniciada com sucesso")
    @ApiResponse(responseCode = "404", description = "Notificação não encontrada")
    @ApiResponse(responseCode = "409", description = "Notificação não pode ser retentada no status atual")
    public ResponseEntity<NotificationResponseDTO> retryNotification(
            @Parameter(description = "UUID da notificação") @PathVariable UUID id) {

        log.info("Retentando envio da notificação: {}", id);

        NotificationResponseDTO retried = notificationService.retryNotification(id);
        return ResponseEntity.ok(retried);
    }

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