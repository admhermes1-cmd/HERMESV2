package com.hermes.repository;

import com.hermes.entity.Notification;
import com.hermes.entity.enums.NotificationChannel;
import com.hermes.entity.enums.NotificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repositório de acesso a dados para a entidade {@link Notification}.
 *
 * <p>Centraliza as operações sobre notificações enviadas ou agendadas pelo HERMES,
 * incluindo listagem com filtros combinados, consultas para o dashboard (contagens,
 * taxa de sucesso, logs paginados) e rastreamento de uso por template ou usuário.</p>
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /**
     * Lista notificações com paginação e filtros opcionais de status e canal.
     *
     * <p>Ambos os filtros são opcionais: quando {@code null}, a condição correspondente
     * é ignorada via JPQL, retornando todos os registros para aquela dimensão.
     * Os resultados são ordenados do mais recente para o mais antigo.</p>
     *
     * @param status   status da notificação ({@code PENDING}, {@code SCHEDULED}, {@code SENT}, {@code FAILED});
     *                 pode ser {@code null} para não filtrar por status
     * @param channel  canal de envio ({@code EMAIL}, {@code SMS}, {@code WHATSAPP});
     *                 pode ser {@code null} para não filtrar por canal
     * @param pageable parâmetros de paginação e ordenação
     * @return página de notificações correspondentes aos filtros aplicados
     */
    @Query("SELECT n FROM Notification n WHERE " +
           "(:status IS NULL OR n.status = :status) AND " +
           "(:channel IS NULL OR n.channel = :channel) " +
           "ORDER BY n.createdAt DESC")
    Page<Notification> findAllWithFilters(
            @Param("status") NotificationStatus status,
            @Param("channel") NotificationChannel channel,
            Pageable pageable
    );

    /**
     * Conta o total de notificações em um determinado status.
     *
     * <p>Utilizado no dashboard para exibir os contadores de cada status
     * ({@code SENT}, {@code FAILED}, {@code SCHEDULED}, {@code PENDING}).</p>
     *
     * @param status status de notificação conforme enum {@link NotificationStatus}
     * @return quantidade de notificações com o status informado
     */
    long countByStatus(NotificationStatus status);

    /**
     * Conta o total de notificações efetivamente enviadas no dia corrente.
     *
     * <p>O parâmetro {@code startOfDay} deve ser calculado na camada de serviço
     * como {@code LocalDate.now().atStartOfDay()} para garantir consistência de fuso horário.
     * Considera apenas registros com {@code status = SENT}.</p>
     *
     * @param startOfDay início do dia atual (00:00:00) no fuso horário da aplicação
     * @return quantidade de notificações enviadas desde o início do dia
     */
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.status = 'SENT' " +
           "AND n.sentAt >= :startOfDay")
    long countSentToday(@Param("startOfDay") LocalDateTime startOfDay);

    /**
     * Conta notificações processadas hoje (enviadas + com falha) para cálculo da taxa de sucesso.
     *
     * <p>Denominador da fórmula: {@code taxaSucesso = countSentToday / countProcessedToday}.
     * Considera apenas os status terminais {@code SENT} e {@code FAILED}.</p>
     *
     * @param startOfDay início do dia atual (00:00:00) no fuso horário da aplicação
     * @return quantidade de notificações em status terminal processadas no dia
     */
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.status IN ('SENT', 'FAILED') " +
           "AND n.createdAt >= :startOfDay")
    long countProcessedToday(@Param("startOfDay") LocalDateTime startOfDay);

    /**
     * Lista notificações paginadas para exibição nos logs do dashboard, com filtro por status.
     *
     * <p>O dashboard mapeia nível de log para status da notificação:
     * <ul>
     *   <li>{@code ERROR} → {@code [FAILED]}</li>
     *   <li>{@code WARN} → {@code [PENDING, SCHEDULED]}</li>
     *   <li>{@code INFO} → {@code [SENT]}</li>
     * </ul>
     * A lista de status é construída na camada de serviço conforme o nível selecionado.
     * Quando {@code statuses} é {@code null}, todos os registros são retornados.</p>
     *
     * @param statuses lista de status a incluir no filtro; pode ser {@code null} para sem filtro
     * @param pageable parâmetros de paginação e ordenação
     * @return página de notificações correspondentes aos status informados, ordenadas pela data de criação
     */
    @Query("SELECT n FROM Notification n WHERE " +
           "(:statuses IS NULL OR n.status IN :statuses) " +
           "ORDER BY n.createdAt DESC")
    Page<Notification> findLogsWithStatusFilter(
            @Param("statuses") List<NotificationStatus> statuses,
            Pageable pageable
    );

    /**
     * Lista todas as notificações associadas a um template específico.
     *
     * <p>Utilizado antes de excluir um template para verificar se ele está em uso,
     * permitindo ao serviço retornar um erro de negócio adequado em vez de
     * uma exceção de constraint de chave estrangeira.</p>
     *
     * @param templateId identificador do template
     * @return lista de notificações que referenciam o template (pode ser vazia)
     */
    List<Notification> findByTemplateId(UUID templateId);

    /**
     * Conta o total de notificações criadas por um usuário específico.
     *
     * <p>Utilizado para estatísticas individuais de uso e relatórios administrativos.</p>
     *
     * @param userId identificador do usuário criador
     * @return quantidade de notificações criadas pelo usuário
     */
    long countByCreatedBy(UUID userId);
}