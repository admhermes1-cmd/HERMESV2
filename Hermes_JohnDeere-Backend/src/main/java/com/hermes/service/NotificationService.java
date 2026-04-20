package com.hermes.service;

import com.hermes.dto.PageResponseDTO;
import com.hermes.dto.notification.NotificationRequestDTO;
import com.hermes.dto.notification.NotificationResponseDTO;
import com.hermes.entity.Notification;
import com.hermes.entity.ScheduledMessage;
import com.hermes.entity.Template;
import com.hermes.entity.TemplateVersion;
import com.hermes.entity.enums.NotificationChannel;
import com.hermes.entity.enums.NotificationStatus;
import com.hermes.entity.enums.ScheduledMessageStatus;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import com.hermes.repository.NotificationRepository;
import com.hermes.repository.ScheduledMessageRepository;
import com.hermes.repository.TemplateRepository;
import com.hermes.repository.TemplateVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Serviço de gerenciamento de notificações do HERMES.
 *
 * <p>Centraliza o ciclo de vida completo de notificações: criação, validação,
 * roteamento de envio (imediato ou agendado), cancelamento e retentativa.
 * É o ponto de orquestração entre os repositórios, o {@link EmailService}
 * e o mecanismo de agendamento via {@link ScheduledMessage}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    /** Limite máximo de tamanho total dos anexos por notificação: 10 MB em bytes. */
    private static final long MAX_ATTACHMENT_SIZE_BYTES = 10L * 1024 * 1024;

    /** Expressão regular simples para validação de formato de e-mail. */
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final NotificationRepository notificationRepository;
    private final ScheduledMessageRepository scheduledMessageRepository;
    private final TemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;
    private final EmailService emailService;

    /**
     * Lista notificações paginadas com filtros opcionais de status e canal.
     *
     * @param status  filtro de status ({@link NotificationStatus}); {@code null} retorna todos
     * @param channel filtro de canal ({@link NotificationChannel}); {@code null} retorna todos
     * @param page    número da página, 1-based (internamente convertido para 0-based)
     * @param limit   quantidade de itens por página
     * @return página de {@link NotificationResponseDTO}
     */
    @Transactional(readOnly = true)
    public PageResponseDTO<NotificationResponseDTO> listNotifications(
            NotificationStatus status, NotificationChannel channel, int page, int limit) {

        log.debug("Listando notificações — status: {}, canal: {}, página: {}, limite: {}",
                status, channel, page, limit);

        Pageable pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        Page<Notification> result = notificationRepository.findAllWithFilters(status, channel, pageable);

        return PageResponseDTO.from(result.map(NotificationResponseDTO::from), page, limit);
    }

    /**
     * Busca uma notificação por ID.
     *
     * @param id UUID da notificação
     * @return {@link NotificationResponseDTO} com todos os dados da notificação
     * @throws AppException {@code NOTIFICATION_NOT_FOUND} se a notificação não existir
     */
    @Transactional(readOnly = true)
    public NotificationResponseDTO getNotification(UUID id) {
        log.debug("Buscando notificação: {}", id);

        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> AppException.notFound(ErrorCode.NOTIFICATION_NOT_FOUND,
                        "Notificação não encontrada: " + id));

        return NotificationResponseDTO.from(notification);
    }

    /**
     * Cria e processa uma nova notificação.
     *
     * <p>O fluxo de processamento segue estas etapas:
     * <ol>
     *   <li>Validação de e-mails dos destinatários (TO, CC, BCC)</li>
     *   <li>Validação do tamanho total dos anexos (limite: 10 MB)</li>
     *   <li>Resolução da versão do template (usa a mais recente se não especificada)</li>
     *   <li>Persistência da notificação com status {@code PENDING}</li>
     *   <li>Roteamento: envio imediato se {@code scheduledAt} é nulo;
     *       criação de {@link ScheduledMessage} caso contrário</li>
     * </ol>
     *
     * @param request     dados da notificação a criar
     * @param attachments arquivos a anexar ao envio; pode ser {@code null} ou vazia
     * @param createdBy   UUID do usuário que originou a requisição
     * @return {@link NotificationResponseDTO} com o estado final da notificação criada
     * @throws AppException {@code TEMPLATE_NOT_FOUND}         se o template referenciado não existir
     * @throws AppException {@code TEMPLATE_VERSION_NOT_FOUND} se a versão especificada não existir
     * @throws AppException {@code NOTIFICATION_INVALID_EMAIL} se algum endereço de e-mail for inválido
     * @throws AppException {@code NOTIFICATION_INVALID_SIZE}  se o total de anexos exceder 10 MB
     */
    @Transactional
    public NotificationResponseDTO createNotification(NotificationRequestDTO request,
                                                       List<MultipartFile> attachments,
                                                       UUID createdBy) {
        log.debug("Criando notificação para o template {} por {}", request.getTemplateId(), createdBy);

        // ── Validações ────────────────────────────────────────────────────────
        validateRecipientEmails(request);
        validateAttachmentSize(attachments);

        // ── Resolução do template e versão ────────────────────────────────────
        Template template = templateRepository.findById(request.getTemplateId())
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND,
                        "Template não encontrado: " + request.getTemplateId()));

        TemplateVersion version = resolveTemplateVersion(request);

        // ── Criação da entidade ───────────────────────────────────────────────
        Notification notification = Notification.builder()
                .channel(request.getChannel())
                .status(NotificationStatus.PENDING)
                .templateId(template.getId())
                .templateVersionId(version.getId())
                .recipients(new Notification.RecipientsData(request.getRecipients().to(), request.getRecipients().cc(), request.getRecipients().bcc()))
                .variables(request.getVariables())
                .attachments(request.getAttachments() != null ? request.getAttachments().stream()
                        .map(a -> new Notification.AttachmentMetadata(a.name(), a.size()))
                        .toList() : null)
                .scheduledAt(request.getScheduledAt())
                .createdBy(createdBy)
                .createdAt(LocalDateTime.now())
                .build();

        notification = notificationRepository.save(notification);

        // ── Roteamento ────────────────────────────────────────────────────────
        if (request.getScheduledAt() == null) {
            notification = sendImmediately(notification, version, attachments);
        } else {
            notification = scheduleForLater(notification, request.getScheduledAt());
        }

        return NotificationResponseDTO.from(notification);
    }

    /**
     * Cancela uma notificação agendada ou pendente.
     *
     * <p>Apenas notificações com status {@code SCHEDULED} ou {@code PENDING} podem ser canceladas.
     * O status é atualizado para {@code FAILED} com a mensagem "Cancelado pelo usuário".
     * Se existir um {@link ScheduledMessage} vinculado, seu status é atualizado para {@code CANCELLED}.
     *
     * @param id UUID da notificação a cancelar
     * @return {@link NotificationResponseDTO} com o estado atualizado
     * @throws AppException {@code NOTIFICATION_NOT_FOUND}    se a notificação não existir
     * @throws AppException {@code NOTIFICATION_CANNOT_CANCEL} se o status atual não permitir cancelamento
     */
    @Transactional
    public NotificationResponseDTO cancelNotification(UUID id) {
        log.debug("Solicitação de cancelamento da notificação: {}", id);

        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> AppException.notFound(ErrorCode.NOTIFICATION_NOT_FOUND,
                        "Notificação não encontrada: " + id));

        if (notification.getStatus() != NotificationStatus.SCHEDULED
                && notification.getStatus() != NotificationStatus.PENDING) {
            throw AppException.badRequest(ErrorCode.NOTIFICATION_CANNOT_CANCEL,
                    "Apenas notificações com status SCHEDULED ou PENDING podem ser canceladas. " +
                            "Status atual: " + notification.getStatus());
        }

        notification.setStatus(NotificationStatus.FAILED);
        notification.setError("Cancelado pelo usuário");
        notification = notificationRepository.save(notification);

        // Cancelar o ScheduledMessage vinculado, se existir
        scheduledMessageRepository.findByNotificationId(id).ifPresent(scheduled -> {
            scheduled.setStatus(ScheduledMessageStatus.CANCELLED);
            scheduledMessageRepository.save(scheduled);
            log.info("ScheduledMessage {} cancelado junto com a notificação {}", scheduled.getId(), id);
        });

        log.info("Notificação {} cancelada", id);
        return NotificationResponseDTO.from(notification);
    }

    /**
     * Retenta o envio de uma notificação que falhou.
     *
     * <p>Apenas notificações com status {@code FAILED} podem ser retentadas.
     * O envio é realizado imediatamente via {@link EmailService}.
     * Em caso de sucesso, o status é atualizado para {@code SENT} e {@code sentAt} é registrado.
     * Em caso de nova falha, o status permanece {@code FAILED} e o erro é atualizado.
     *
     * @param id UUID da notificação a retentar
     * @return {@link NotificationResponseDTO} com o estado final após a retentativa
     * @throws AppException {@code NOTIFICATION_NOT_FOUND}    se a notificação não existir
     * @throws AppException {@code NOTIFICATION_CANNOT_RETRY} se o status atual não permitir retentativa
     */
    @Transactional
    public NotificationResponseDTO retryNotification(UUID id) {
        log.debug("Solicitação de retentativa para a notificação: {}", id);

        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> AppException.notFound(ErrorCode.NOTIFICATION_NOT_FOUND,
                        "Notificação não encontrada: " + id));

        if (notification.getStatus() != NotificationStatus.FAILED) {
            throw AppException.badRequest(ErrorCode.NOTIFICATION_CANNOT_RETRY,
                    "Apenas notificações com status FAILED podem ser retentadas. " +
                            "Status atual: " + notification.getStatus());
        }

        UUID versionId = notification.getTemplateVersionId();

        TemplateVersion version = templateVersionRepository.findById(versionId)
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_VERSION_NOT_FOUND,
                        "Versão do template não encontrada: " + versionId));

        try {
            emailService.sendEmail(notification, version, List.of());
            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notification.setError(null);
            log.info("Retentativa bem-sucedida para a notificação: {}", id);
        } catch (AppException ex) {
            notification.setError(ex.getMessage());
            log.warn("Retentativa falhou para a notificação {}: {}", id, ex.getMessage());
        }

        notification = notificationRepository.save(notification);
        return NotificationResponseDTO.from(notification);
    }

    // ── Métodos privados ──────────────────────────────────────────────────────

    /**
     * Realiza o envio imediato do e-mail e atualiza o status da notificação.
     *
     * @param notification notificação já persistida com status {@code PENDING}
     * @param version      versão do template com o conteúdo a enviar
     * @param attachments  arquivos a anexar
     * @return notificação atualizada com status {@code SENT} ou {@code FAILED}
     */
    private Notification sendImmediately(Notification notification, TemplateVersion version,
                                          List<MultipartFile> attachments) {
        try {
            emailService.sendEmail(notification, version,
                    attachments != null ? attachments : List.of());
            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            log.info("Notificação {} enviada imediatamente", notification.getId());
        } catch (AppException ex) {
            notification.setStatus(NotificationStatus.FAILED);
            notification.setError(ex.getMessage());
            log.warn("Falha no envio imediato da notificação {}: {}", notification.getId(), ex.getMessage());
        }
        return notificationRepository.save(notification);
    }

    /**
     * Cria um {@link ScheduledMessage} para envio futuro e atualiza o status da notificação.
     *
     * <p>O horário de agendamento é validado como sendo obrigatoriamente no futuro.
     *
     * @param notification notificação já persistida com status {@code PENDING}
     * @param scheduledAt  data e hora alvo para o envio
     * @return notificação atualizada com status {@code SCHEDULED}
     * @throws AppException {@code NOTIFICATION_INVALID_SCHEDULED_AT} se a data for no passado ou presente
     */
    private Notification scheduleForLater(Notification notification, LocalDateTime scheduledAt) {
        if (!scheduledAt.isAfter(LocalDateTime.now())) {
            throw AppException.badRequest(ErrorCode.NOTIFICATION_INVALID_SCHEDULED_AT,
                    "A data de agendamento deve ser futura.");
        }

        ScheduledMessage scheduled = ScheduledMessage.builder()
                .notification(notification)
                .scheduledAt(scheduledAt)
                .status(ScheduledMessageStatus.PENDING)
                .attempts(0)
                .build();

        scheduledMessageRepository.save(scheduled);

        notification.setStatus(NotificationStatus.SCHEDULED);
        Notification saved = notificationRepository.save(notification);

        log.info("Notificação {} agendada para {}", notification.getId(), scheduledAt);
        return saved;
    }

    /**
     * Resolve a versão do template a ser utilizada no envio.
     *
     * <p>Se {@code templateVersionId} for fornecido no request, busca diretamente por ID.
     * Caso contrário, busca a versão mais recente do template.
     *
     * @param request dados da requisição contendo {@code templateId} e, opcionalmente, {@code templateVersionId}
     * @return versão do template resolvida
     * @throws AppException {@code TEMPLATE_VERSION_NOT_FOUND} se a versão não for encontrada
     */
    private TemplateVersion resolveTemplateVersion(NotificationRequestDTO request) {
        if (request.getTemplateVersionId() != null) {
            return templateVersionRepository.findById(request.getTemplateVersionId())
                    .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_VERSION_NOT_FOUND,
                            "Versão do template não encontrada: " + request.getTemplateVersionId()));
        }

        return templateVersionRepository.findLatestByTemplateId(request.getTemplateId())
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_VERSION_NOT_FOUND,
                        "Nenhuma versão encontrada para o template: " + request.getTemplateId()));
    }

    /**
     * Valida os endereços de e-mail presentes nos destinatários TO, CC e BCC.
     *
     * @param request dados da requisição contendo os destinatários
     * @throws AppException {@code NOTIFICATION_INVALID_EMAIL} se algum endereço for inválido
     */
    private void validateRecipientEmails(NotificationRequestDTO request) {
        var recipients = request.getRecipients();
        if (recipients == null) return;

        validateEmailList("TO", recipients.to());
        validateEmailList("CC", recipients.cc());
        validateEmailList("BCC", recipients.bcc());
    }

    /**
     * Valida uma lista de endereços de e-mail pelo formato esperado.
     *
     * @param fieldName nome do campo (TO, CC ou BCC) usado na mensagem de erro
     * @param emails    lista de endereços a validar; {@code null} é ignorado
     * @throws AppException {@code NOTIFICATION_INVALID_EMAIL} se algum endereço for inválido
     */
    private void validateEmailList(String fieldName, List<String> emails) {
        if (emails == null || emails.isEmpty()) return;

        for (String email : emails) {
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                throw AppException.badRequest(ErrorCode.NOTIFICATION_INVALID_EMAIL,
                        "Endereço de e-mail inválido no campo " + fieldName + ": " + email);
            }
        }
    }

    /**
     * Valida que o tamanho total dos anexos não ultrapassa o limite de 10 MB.
     *
     * @param attachments lista de arquivos a verificar; {@code null} é ignorado
     * @throws AppException {@code NOTIFICATION_INVALID_SIZE} se o total exceder o limite configurado
     */
    private void validateAttachmentSize(List<MultipartFile> attachments) {
        if (attachments == null || attachments.isEmpty()) return;

        long totalBytes = attachments.stream()
                .filter(f -> f != null && !f.isEmpty())
                .mapToLong(MultipartFile::getSize)
                .sum();

        if (totalBytes > MAX_ATTACHMENT_SIZE_BYTES) {
            throw AppException.badRequest(ErrorCode.NOTIFICATION_INVALID_SIZE,
                    String.format("O tamanho total dos anexos (%.2f MB) excede o limite permitido de 10 MB.",
                            totalBytes / (1024.0 * 1024.0)));
        }
    }
}