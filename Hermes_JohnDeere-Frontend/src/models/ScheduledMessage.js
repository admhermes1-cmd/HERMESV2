/**
 * @fileoverview ScheduledMessage model — DTO puro sem lógica de negócio.
 * Representa o registro de controle de uma mensagem agendada na fila de
 * processamento assíncrono do HERMES. Cada tentativa de envio é rastreada
 * aqui, permitindo reprocessamento inteligente com backoff.
 *
 * @module models/ScheduledMessage
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Estados do ciclo de vida de uma mensagem na fila de agendamento.
 * @readonly
 * @enum {string}
 */
export const ScheduledMessageStatus = Object.freeze({
  /** Aguardando a hora programada para ser processada. */
  PENDING:    'PENDING',
  /** Sendo processada no momento (lock adquirido pelo worker). */
  PROCESSING: 'PROCESSING',
  /** Enviada com sucesso; registro encerrado. */
  DONE:       'DONE',
  /** Cancelada manualmente ou após exceder o limite de tentativas. */
  CANCELLED:  'CANCELLED',
});

// ---------------------------------------------------------------------------
// Tipos (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ScheduledMessage
 * @property {string}               id             - Identificador único (UUID).
 * @property {string}               notificationId - ID da Notification associada.
 * @property {string}               scheduledAt    - ISO 8601 do momento planejado para envio.
 * @property {ScheduledMessageStatus} status       - Status atual na fila.
 * @property {number}               attempts       - Número de tentativas de envio realizadas.
 * @property {string|null}          lastAttemptAt  - ISO 8601 da última tentativa; null se nunca tentado.
 * @property {string|null}          nextAttemptAt  - ISO 8601 da próxima tentativa agendada; null se não aplicável.
 * @property {string|null}          error          - Detalhe do último erro ocorrido.
 * @property {string}               createdAt      - ISO 8601 de criação do registro.
 */

/**
 * @typedef {Object} ScheduledMessageValidationResult
 * @property {boolean}  valid  - true se o modelo é válido.
 * @property {string[]} errors - Lista de mensagens de erro encontradas.
 */

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Cria um objeto ScheduledMessage com valores padrão seguros.
 *
 * @param {Partial<ScheduledMessage>} [data={}] - Dados parciais do registro de agendamento.
 * @returns {Readonly<ScheduledMessage>}
 *
 * @example
 * const scheduled = createScheduledMessage({
 *   notificationId: 'notif-123',
 *   scheduledAt: '2025-12-31T23:59:00.000Z',
 * });
 */
export function createScheduledMessage(data = {}) {
  return Object.freeze({
    id:             data.id             ?? '',
    notificationId: data.notificationId ?? '',
    scheduledAt:    data.scheduledAt    ?? new Date().toISOString(),
    status:         data.status         ?? ScheduledMessageStatus.PENDING,
    attempts:       typeof data.attempts === 'number' ? data.attempts : 0,
    lastAttemptAt:  data.lastAttemptAt  ?? null,
    nextAttemptAt:  data.nextAttemptAt  ?? null,
    error:          data.error          ?? null,
    createdAt:      data.createdAt      ?? new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Utilitário de negócio
// ---------------------------------------------------------------------------

/**
 * Determina se uma mensagem agendada pode ser reprocessada.
 *
 * Condições para reprocessamento:
 * 1. Status deve ser `PENDING` ou `PROCESSING` (não DONE ou CANCELLED).
 * 2. Número de tentativas realizadas deve ser menor que `maxAttempts`.
 *
 * @param {ScheduledMessage} scheduledMessage - Registro a ser avaliado.
 * @param {number} [maxAttempts=3] - Número máximo de tentativas permitidas.
 * @returns {boolean} `true` se ainda é possível tentar o reenvio.
 *
 * @example
 * if (canRetry(message)) {
 *   await dispatchRetry(message);
 * } else {
 *   await markAsCancelled(message);
 * }
 */
export function canRetry(scheduledMessage, maxAttempts = 3) {
  const retryableStatuses = [
    ScheduledMessageStatus.PENDING,
    ScheduledMessageStatus.PROCESSING,
  ];

  const statusAllowsRetry = retryableStatuses.includes(scheduledMessage.status);
  const attemptsNotExhausted = scheduledMessage.attempts < maxAttempts;

  return statusAllowsRetry && attemptsNotExhausted;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Valida um objeto ScheduledMessage.
 *
 * Regras verificadas:
 * - `notificationId` obrigatório.
 * - `scheduledAt` deve ser uma data/hora válida em ISO 8601.
 * - `status` deve ser um valor de `ScheduledMessageStatus`.
 * - `attempts` deve ser um inteiro não-negativo.
 * - `lastAttemptAt`, se presente, deve ser data válida.
 * - `nextAttemptAt`, se presente, deve ser data válida.
 *
 * @param {ScheduledMessage} scheduledMessage
 * @returns {ScheduledMessageValidationResult}
 */
export function validateScheduledMessage(scheduledMessage) {
  const errors = [];

  // notificationId
  if (!scheduledMessage.notificationId || scheduledMessage.notificationId.trim() === '') {
    errors.push('notificationId: campo obrigatório.');
  }

  // scheduledAt
  if (!scheduledMessage.scheduledAt) {
    errors.push('scheduledAt: campo obrigatório.');
  } else if (isNaN(new Date(scheduledMessage.scheduledAt).getTime())) {
    errors.push('scheduledAt: formato de data inválido (use ISO 8601).');
  }

  // status
  if (!Object.values(ScheduledMessageStatus).includes(scheduledMessage.status)) {
    errors.push(
      `status: valor "${scheduledMessage.status}" inválido. Use: ${Object.values(ScheduledMessageStatus).join(' | ')}.`
    );
  }

  // attempts
  if (!Number.isInteger(scheduledMessage.attempts) || scheduledMessage.attempts < 0) {
    errors.push('attempts: deve ser um inteiro não-negativo.');
  }

  // lastAttemptAt (opcional, mas se presente deve ser data válida)
  if (scheduledMessage.lastAttemptAt !== null && scheduledMessage.lastAttemptAt !== undefined) {
    if (isNaN(new Date(scheduledMessage.lastAttemptAt).getTime())) {
      errors.push('lastAttemptAt: formato de data inválido (use ISO 8601).');
    }
  }

  // nextAttemptAt (opcional, mas se presente deve ser data válida)
  if (scheduledMessage.nextAttemptAt !== null && scheduledMessage.nextAttemptAt !== undefined) {
    if (isNaN(new Date(scheduledMessage.nextAttemptAt).getTime())) {
      errors.push('nextAttemptAt: formato de data inválido (use ISO 8601).');
    }
  }

  return { valid: errors.length === 0, errors };
}