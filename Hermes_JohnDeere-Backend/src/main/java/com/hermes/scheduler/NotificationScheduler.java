package com.hermes.scheduler;

import com.hermes.entity.Notification;
import com.hermes.entity.ScheduledMessage;
import com.hermes.entity.TemplateVersion;
import com.hermes.entity.enums.NotificationStatus;
import com.hermes.entity.enums.ScheduledMessageStatus;
import com.hermes.repository.NotificationRepository;
import com.hermes.repository.ScheduledMessageRepository;
import com.hermes.repository.TemplateVersionRepository;
import com.hermes.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler central do HERMES responsável por processar mensagens agendadas.
 *
 * <p>Executa em ciclos periódicos (configurável via {@code hermes.scheduler.cron}) e realiza
 * três operações em sequência:
 * <ol>
 *   <li>Processamento de mensagens pendentes prontas para envio;</li>
 *   <li>Processamento de retentativas com backoff exponencial;</li>
 *   <li>Recuperação de <em>stuck jobs</em> presos em estado {@code PROCESSING}.</li>
 * </ol>
 *
 * <p>Falhas individuais são totalmente isoladas via {@code try/catch} por mensagem,
 * garantindo que um erro pontual não interrompa o ciclo completo.
 *
 * <p>Nota: {@code @EnableScheduling} deve estar habilitado na classe principal
 * {@code HermesApplication} (ou em qualquer {@code @Configuration}) para que os
 * métodos {@code @Scheduled} desta classe sejam ativados pelo container Spring.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationScheduler {

    // -------------------------------------------------------------------------
    // Dependências injetadas
    // -------------------------------------------------------------------------

    private final ScheduledMessageRepository scheduledMessageRepository;
    private final NotificationRepository notificationRepository;
    private final TemplateVersionRepository templateVersionRepository;
    private final EmailService emailService;

    /**
     * Número máximo de tentativas de envio antes de cancelar definitivamente a mensagem.
     * Configurável via {@code hermes.scheduler.max-retry-attempts} no {@code application.yml}.
     */
    @Value("${hermes.scheduler.max-retry-attempts}")
    private int maxRetryAttempts;

    // =========================================================================
    // CICLO PRINCIPAL
    // =========================================================================

    /**
     * Ciclo principal do scheduler — executado a cada 30 segundos (configurável).
     *
     * <p>Orquestra as três fases do ciclo:
     * <ol>
     *   <li>{@link #processPendingMessages()} — envia mensagens com {@code scheduledAt <= agora};</li>
     *   <li>{@link #processRetryableMessages()} — reenvia falhas prontas pelo backoff;</li>
     *   <li>{@link #recoverStuckJobs()} — desbloqueia mensagens presas em {@code PROCESSING}.</li>
     * </ol>
     *
     * <p>Falhas em qualquer fase não propagam para as demais — cada fase possui seu
     * próprio isolamento interno por mensagem.
     */
    @Scheduled(cron = "${hermes.scheduler.cron}")
    public void processScheduledNotifications() {
        log.debug("Iniciando ciclo do scheduler");

        processPendingMessages();
        processRetryableMessages();
        recoverStuckJobs();

        log.debug("Ciclo do scheduler concluído");
    }

    // =========================================================================
    // FASE 1 — MENSAGENS PENDENTES
    // =========================================================================

    /**
     * Busca e processa mensagens agendadas prontas para envio.
     *
     * <p>Critérios de seleção: {@code status = PENDING} e {@code scheduledAt <= agora}.
     * Se não houver mensagens, retorna sem produzir nenhum log para evitar ruído.
     *
     * <p>Cada mensagem é processada de forma isolada via {@link #processMessage(ScheduledMessage)}.
     */
    @Transactional
    private void processPendingMessages() {
        List<ScheduledMessage> messages =
                scheduledMessageRepository.findPendingReadyToSend(LocalDateTime.now());

        if (messages.isEmpty()) {
            return;
        }

        log.info("Processando {} mensagem(ns) agendada(s)", messages.size());

        for (ScheduledMessage scheduledMessage : messages) {
            processMessage(scheduledMessage);
        }
    }

    // =========================================================================
    // FASE 2 — RETENTATIVAS
    // =========================================================================

    /**
     * Busca e processa mensagens que falharam e estão prontas para nova tentativa.
     *
     * <p>Critérios de seleção: {@code status = FAILED}, {@code attempts < maxRetryAttempts}
     * e {@code nextAttemptAt <= agora}. O intervalo entre tentativas é calculado com
     * backoff exponencial ({@code 2^attempts} minutos) em {@link #handleFailure}.
     *
     * <p>Se não houver retentativas elegíveis, retorna silenciosamente.
     */
    @Transactional
    private void processRetryableMessages() {
        List<ScheduledMessage> messages =
                scheduledMessageRepository.findRetryable(maxRetryAttempts, LocalDateTime.now());

        if (messages.isEmpty()) {
            return;
        }

        log.info("Processando {} retentativa(s)", messages.size());

        for (ScheduledMessage scheduledMessage : messages) {
            processMessage(scheduledMessage);
        }
    }

    // =========================================================================
    // FASE 3 — RECUPERAÇÃO DE STUCK JOBS
    // =========================================================================

    /**
     * Recupera mensagens presas em status {@code PROCESSING} por mais de 5 minutos.
     *
     * <p>Mensagens neste estado indicam falha silenciosa ou crash durante um ciclo
     * anterior (ex: reinicialização da JVM, timeout de transação). São marcadas como
     * {@code FAILED} para que o mecanismo de retry as reprocesse normalmente no próximo ciclo.
     *
     * <p>O threshold de 5 minutos garante que mensagens em processamento legítimo e
     * rápido não sejam inadvertidamente marcadas como stuck.
     */
    @Transactional
    private void recoverStuckJobs() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(5);
        List<ScheduledMessage> stuckJobs =
                scheduledMessageRepository.findStuckProcessing(threshold);

        if (stuckJobs.isEmpty()) {
            return;
        }

        log.warn("Recuperando {} stuck job(s) — marcando como FAILED", stuckJobs.size());

        for (ScheduledMessage scheduledMessage : stuckJobs) {
            scheduledMessage.setStatus(ScheduledMessageStatus.FAILED);
            scheduledMessage.setError("Processamento interrompido — recuperado pelo scheduler");
            scheduledMessageRepository.save(scheduledMessage);
        }
    }

    // =========================================================================
    // PROCESSAMENTO INDIVIDUAL DE MENSAGEM
    // =========================================================================

    /**
     * Processa uma única mensagem agendada do início ao fim.
     *
     * <p>Fluxo interno:
     * <ol>
     *   <li>Marca a mensagem como {@code PROCESSING} (evita reprocessamento paralelo);</li>
     *   <li>Busca a {@link TemplateVersion} associada à notificação;</li>
     *   <li>Invoca {@link EmailService#sendEmail} para realizar o envio efetivo;</li>
     *   <li>Em caso de sucesso, delega para {@link #handleSuccess};</li>
     *   <li>Em caso de falha, delega para {@link #handleFailure} — sem propagar a exceção.</li>
     * </ol>
     *
     * <p>O bloco {@code try/catch} garante que uma exceção em uma mensagem não
     * interrompa o processamento das demais no mesmo ciclo.
     *
     * @param scheduledMessage mensagem agendada a ser processada; nunca {@code null}
     */
    private void processMessage(ScheduledMessage scheduledMessage) {
        // Marcar como PROCESSING antes de qualquer operação para prevenir
        // reprocessamento em execuções concorrentes ou paralelas.
        scheduledMessage.setStatus(ScheduledMessageStatus.PROCESSING);
        scheduledMessage.setLastAttemptAt(LocalDateTime.now());
        scheduledMessageRepository.save(scheduledMessage);

        try {
            Notification notification = scheduledMessage.getNotification();

            // Buscar a versão do template vinculada à notificação.
            // Lança IllegalStateException se a versão tiver sido deletada/desativada,
            // garantindo que o erro seja capturado e tratado como falha de envio.
            TemplateVersion version = templateVersionRepository
                    .findById(notification.getTemplateVersionId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Versão do template não encontrada: "
                                    + notification.getTemplateVersionId()));

            // Realizar o envio. Anexos físicos não são gerenciados aqui —
            // ScheduledMessage carrega apenas metadados (nome, tamanho).
            emailService.sendEmail(notification, version, List.of());

            handleSuccess(scheduledMessage, notification);

        } catch (Exception ex) {
            // Isolar a falha: logar, atualizar estado e continuar o ciclo.
            handleFailure(scheduledMessage, scheduledMessage.getNotification(), ex);
        }
    }

    // =========================================================================
    // TRATAMENTO DE SUCESSO
    // =========================================================================

    /**
     * Atualiza as entidades após um envio bem-sucedido.
     *
     * <p>Transições de estado:
     * <ul>
     *   <li>{@link ScheduledMessage}: {@code PROCESSING → DONE}</li>
     *   <li>{@link Notification}: qualquer status {@code → SENT}, com {@code sentAt} preenchido
     *       e {@code error} limpo.</li>
     * </ul>
     *
     * @param scheduledMessage mensagem processada com sucesso
     * @param notification     notificação vinculada à mensagem
     */
    private void handleSuccess(ScheduledMessage scheduledMessage, Notification notification) {
        scheduledMessage.setStatus(ScheduledMessageStatus.DONE);

        notification.setStatus(NotificationStatus.SENT);
        notification.setSentAt(LocalDateTime.now());
        notification.setError(null);

        scheduledMessageRepository.save(scheduledMessage);
        notificationRepository.save(notification);

        log.info(
                "Notificação {} enviada com sucesso (tentativa {})",
                notification.getId(),
                scheduledMessage.getAttempts() + 1
        );
    }

    // =========================================================================
    // TRATAMENTO DE FALHA
    // =========================================================================

    /**
     * Atualiza as entidades após uma falha no envio, aplicando backoff exponencial.
     *
     * <p>Estratégia de backoff: {@code delay = 2^attempts} minutos, calculado após o
     * incremento do contador de tentativas. Exemplos:
     * <ul>
     *   <li>1ª falha → próxima tentativa em 2 min</li>
     *   <li>2ª falha → próxima tentativa em 4 min</li>
     *   <li>3ª falha (≥ maxRetryAttempts) → {@code CANCELLED}, sem nova tentativa</li>
     * </ul>
     *
     * <p>Transições de estado:
     * <ul>
     *   <li>Se {@code newAttempts < maxRetryAttempts}: {@code ScheduledMessage → FAILED}
     *       (elegível para retry), {@code Notification → FAILED}</li>
     *   <li>Se {@code newAttempts >= maxRetryAttempts}: {@code ScheduledMessage → CANCELLED}
     *       (excluído do retry), {@code Notification → FAILED}</li>
     * </ul>
     *
     * @param scheduledMessage mensagem que falhou ao ser enviada
     * @param notification     notificação vinculada à mensagem
     * @param ex               exceção capturada durante a tentativa de envio
     */
    private void handleFailure(
            ScheduledMessage scheduledMessage,
            Notification notification,
            Exception ex) {

        int newAttempts = scheduledMessage.getAttempts() + 1;
        scheduledMessage.setAttempts(newAttempts);
        scheduledMessage.setError(ex.getMessage());

        // Backoff exponencial: delay = 2^attempts minutos.
        // O nextAttemptAt é registrado mesmo no último ciclo (antes do CANCELLED)
        // para fins de auditoria — o status CANCELLED impede novas buscas de retry.
        long delayMinutes = (long) Math.pow(2, newAttempts);
        scheduledMessage.setNextAttemptAt(LocalDateTime.now().plusMinutes(delayMinutes));

        if (newAttempts >= maxRetryAttempts) {
            // Esgotadas todas as tentativas — desistir definitivamente.
            scheduledMessage.setStatus(ScheduledMessageStatus.CANCELLED);
            notification.setStatus(NotificationStatus.FAILED);
            notification.setError(
                    "Falha após " + newAttempts + " tentativa(s): " + ex.getMessage());

            log.error(
                    "Notificação {} cancelada após {} tentativa(s) — {}",
                    notification.getId(),
                    newAttempts,
                    ex.getMessage()
            );
        } else {
            // Ainda há tentativas disponíveis — agendar retry via backoff.
            scheduledMessage.setStatus(ScheduledMessageStatus.FAILED);
            notification.setStatus(NotificationStatus.FAILED);
            notification.setError(
                    "Tentativa " + newAttempts + " falhou: " + ex.getMessage());

            log.warn(
                    "Notificação {} falhou (tentativa {}/{}) — próxima tentativa em {} min",
                    notification.getId(),
                    newAttempts,
                    maxRetryAttempts,
                    delayMinutes
            );
        }

        scheduledMessageRepository.save(scheduledMessage);
        notificationRepository.save(notification);
    }
}