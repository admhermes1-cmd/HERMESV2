package com.hermes.service;

import com.hermes.dto.PageResponseDTO;
import com.hermes.dto.dashboard.DashboardStatsDTO;
import com.hermes.dto.dashboard.LogEntryDTO;
import com.hermes.entity.Notification;
import com.hermes.entity.enums.NotificationStatus;
import com.hermes.repository.NotificationRepository;
import com.hermes.repository.ScheduledMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Serviço de dashboard do HERMES.
 *
 * <p>Agrega estatísticas do sistema e fornece uma visão consolidada
 * do estado das notificações para exibição em painéis de monitoramento.
 * Todos os métodos são somente-leitura ({@code readOnly = true}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final NotificationRepository notificationRepository;
    private final ScheduledMessageRepository scheduledMessageRepository;

    /**
     * Retorna as estatísticas consolidadas do sistema para o dia atual.
     *
     * <p>As métricas calculadas são:
     * <ul>
     *   <li>{@code sent}       — total de notificações enviadas com sucesso</li>
     *   <li>{@code failed}     — total de notificações com falha</li>
     *   <li>{@code scheduled}  — total de notificações agendadas aguardando envio</li>
     *   <li>{@code pending}    — total de notificações pendentes de processamento</li>
     *   <li>{@code totalToday} — notificações processadas (SENT + FAILED) no dia corrente</li>
     *   <li>{@code successRate}— taxa de sucesso: {@code sent / (sent + failed)};
     *                            retorna {@code 0.0} se ambos forem zero</li>
     * </ul>
     *
     * @return {@link DashboardStatsDTO} com todas as métricas agregadas
     */
    @Transactional(readOnly = true)
    public DashboardStatsDTO getStats() {
        log.debug("Calculando estatísticas do dashboard");

        long sent = notificationRepository.countByStatus(NotificationStatus.SENT);
        long failed = notificationRepository.countByStatus(NotificationStatus.FAILED);
        long scheduled = notificationRepository.countByStatus(NotificationStatus.SCHEDULED);
        long pending = notificationRepository.countByStatus(NotificationStatus.PENDING);

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        long totalToday = notificationRepository.countSentToday(startOfDay);

        log.debug("Stats — sent: {}, failed: {}, scheduled: {}, pending: {}, today: {}",
                sent, failed, scheduled, pending, totalToday);

        return DashboardStatsDTO.of(sent, failed, scheduled, pending, totalToday);
    }

    /**
     * Retorna os logs de notificações paginados, com filtro opcional por nível de log.
     *
     * <p>O nível de log é mapeado para status de notificação conforme a convenção:
     * <ul>
     *   <li>{@code "ERROR"} → {@link NotificationStatus#FAILED}</li>
     *   <li>{@code "WARN"}  → {@link NotificationStatus#SCHEDULED}</li>
     *   <li>{@code "INFO"}  → {@link NotificationStatus#SENT} e {@link NotificationStatus#PENDING}</li>
     *   <li>{@code null}    → todos os status (sem filtro)</li>
     * </ul>
     *
     * <p>Valores de {@code level} não reconhecidos resultam em retorno sem filtro de status.
     *
     * @param level filtro de nível de log ({@code "ERROR"}, {@code "WARN"}, {@code "INFO"});
     *              {@code null} retorna todos os registros
     * @param page  número da página, 1-based (internamente convertido para 0-based)
     * @param limit quantidade de itens por página
     * @return página de {@link LogEntryDTO} ordenada por data de criação decrescente
     */
    @Transactional(readOnly = true)
    public PageResponseDTO<LogEntryDTO> getLogs(String level, int page, int limit) {
        log.debug("Buscando logs — level: {}, página: {}, limite: {}", level, page, limit);

        List<NotificationStatus> statusFilter = resolveStatusFilter(level);

        Pageable pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        Page<Notification> result = notificationRepository.findLogsWithStatusFilter(statusFilter, pageable);

        return PageResponseDTO.from(result.map(LogEntryDTO::fromNotification), page, limit);
    }

    // ── Métodos privados ──────────────────────────────────────────────────────

    /**
     * Converte o nível de log informado em uma lista de {@link NotificationStatus} equivalentes.
     *
     * <p>Retorna {@code null} quando não há filtro a aplicar (todos os status devem ser retornados),
     * permitindo que o repositório interprete o valor nulo como ausência de restrição.
     *
     * @param level nível de log a converter; pode ser {@code null}
     * @return lista de status correspondentes, ou {@code null} para retornar todos
     */
    private List<NotificationStatus> resolveStatusFilter(String level) {
        if (level == null) {
            return null;
        }

        return switch (level.toUpperCase()) {
            case "ERROR" -> List.of(NotificationStatus.FAILED);
            case "WARN"  -> List.of(NotificationStatus.SCHEDULED);
            case "INFO"  -> List.of(NotificationStatus.SENT, NotificationStatus.PENDING);
            default      -> null;
        };
    }
}