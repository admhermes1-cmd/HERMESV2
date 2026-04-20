package com.hermes.repository;

import com.hermes.entity.ScheduledMessage;
import com.hermes.entity.enums.ScheduledMessageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de acesso a dados para a entidade {@link ScheduledMessage}.
 *
 * <p>Suporta o subsistema de agendamento do HERMES, provendo as queries
 * necessárias para o scheduler periódico: busca de mensagens prontas para envio,
 * detecção de jobs travados, retentativas automáticas e atualização em lote de status.</p>
 */
@Repository
public interface ScheduledMessageRepository extends JpaRepository<ScheduledMessage, UUID> {

    /**
     * Busca mensagens agendadas pendentes que já atingiram seu horário de envio.
     *
     * <p>Executado pelo scheduler a cada 30 segundos para obter o lote de mensagens
     * a processar. Filtra apenas registros com {@code status = PENDING} e
     * {@code scheduledAt <= now}, ordenando pelos mais antigos primeiro (FIFO)
     * para garantir equidade no processamento.</p>
     *
     * @param now instante atual; deve ser {@code LocalDateTime.now()} calculado no serviço
     * @return lista de mensagens prontas para envio, ordenadas por horário agendado crescente
     */
    @Query("SELECT sm FROM ScheduledMessage sm WHERE sm.status = 'PENDING' " +
           "AND sm.scheduledAt <= :now " +
           "ORDER BY sm.scheduledAt ASC")
    List<ScheduledMessage> findPendingReadyToSend(@Param("now") LocalDateTime now);

    /**
     * Busca mensagens que falharam e são elegíveis para retentativa.
     *
     * <p>Uma mensagem é retentável quando:
     * <ul>
     *   <li>{@code status = FAILED}</li>
     *   <li>{@code attempts < maxAttempts} (não esgotou as tentativas)</li>
     *   <li>{@code nextAttemptAt} é nulo ou já passou (backoff expirado)</li>
     * </ul>
     * O valor de {@code maxAttempts} é configurado externamente e passado como parâmetro
     * para manter o repositório desacoplado das configurações da aplicação.</p>
     *
     * @param maxAttempts número máximo de tentativas configurado para o sistema
     * @param now         instante atual para comparar com {@code nextAttemptAt}
     * @return lista de mensagens elegíveis para nova tentativa de envio
     */
    @Query("SELECT sm FROM ScheduledMessage sm WHERE sm.status = 'FAILED' " +
           "AND sm.attempts < :maxAttempts " +
           "AND (sm.nextAttemptAt IS NULL OR sm.nextAttemptAt <= :now)")
    List<ScheduledMessage> findRetryable(
            @Param("maxAttempts") int maxAttempts,
            @Param("now") LocalDateTime now
    );

    /**
     * Busca o agendamento associado a uma notificação específica.
     *
     * <p>Utilizado para verificar se uma notificação já possui um agendamento
     * antes de criar um novo, evitando duplicatas e garantindo consistência
     * do mapeamento {@code 1:1} entre notificação e agendamento.</p>
     *
     * @param notificationId identificador da notificação
     * @return {@link Optional} contendo o agendamento vinculado, ou vazio se não houver
     */
    Optional<ScheduledMessage> findByNotificationId(UUID notificationId);

    /**
     * Conta o total de mensagens agendadas em um determinado status.
     *
     * <p>Usado nas estatísticas do dashboard para monitorar o volume de mensagens
     * em cada fase do ciclo de vida do agendamento.</p>
     *
     * @param status status do agendamento conforme enum {@link ScheduledMessageStatus}
     * @return quantidade de mensagens com o status informado
     */
    long countByStatus(ScheduledMessageStatus status);

    /**
     * Atualiza o status de múltiplas mensagens agendadas em uma única operação.
     *
     * <p>Utilizado pelo scheduler para marcar atomicamente um lote de mensagens
     * como {@code PROCESSING} antes de despachar os envios, evitando que outro
     * nó do cluster processe as mesmas mensagens simultaneamente (proteção básica
     * contra processamento duplicado — para ambientes multi-nó, considerar
     * lock pessimista ou SELECT FOR UPDATE).</p>
     *
     * @param status novo status a atribuir às mensagens
     * @param ids    lista de identificadores das mensagens a atualizar
     * @return quantidade de registros efetivamente atualizados
     */
    @Modifying
    @Transactional
    @Query("UPDATE ScheduledMessage sm SET sm.status = :status WHERE sm.id IN :ids")
    int updateStatusByIds(
            @Param("status") ScheduledMessageStatus status,
            @Param("ids") List<UUID> ids
    );

    /**
     * Busca mensagens presas no status {@code PROCESSING} por mais tempo que o esperado.
     *
     * <p>Detecta "stuck jobs": mensagens que foram marcadas como {@code PROCESSING}
     * mas cujo {@code lastAttemptAt} é anterior ao limiar informado, indicando
     * falha silenciosa (crash do worker, timeout de rede etc.).
     * O scheduler de recovery pode recolocá-las em {@code PENDING} para reprocessamento.</p>
     *
     * @param threshold instante limite; mensagens com {@code lastAttemptAt <= threshold}
     *                  são consideradas travadas (ex: {@code now - 5 minutos})
     * @return lista de mensagens travadas em processamento
     */
    @Query("SELECT sm FROM ScheduledMessage sm WHERE sm.status = 'PROCESSING' " +
           "AND sm.lastAttemptAt <= :threshold")
    List<ScheduledMessage> findStuckProcessing(@Param("threshold") LocalDateTime threshold);
}