/**
 * @fileoverview Notification model — DTO puro sem lógica de negócio.
 * Modela uma solicitação de envio de mensagem (imediata ou agendada)
 * para qualquer canal suportado pelo HERMES.
 *
 * @module models/Notification
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Canais de comunicação suportados para envio de notificações.
 * Deve permanecer sincronizado com `TemplateChannel` do modelo Template.
 * @readonly
 * @enum {string}
 */
export const NotificationChannel = Object.freeze({
  EMAIL:    'EMAIL',
  SMS:      'SMS',
  WHATSAPP: 'WHATSAPP',
});

/**
 * Ciclo de vida de uma notificação dentro do HERMES.
 * @readonly
 * @enum {string}
 */
export const NotificationStatus = Object.freeze({
  /** Criada, aguardando processamento. */
  PENDING:   'PENDING',
  /** Agendada para envio futuro. */
  SCHEDULED: 'SCHEDULED',
  /** Enviada com sucesso. */
  SENT:      'SENT',
  /** Falha no envio; verificar `error` para detalhes. */
  FAILED:    'FAILED',
});

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Limite máximo de tamanho total de anexos (corpo + anexos), em bytes.
 * Equivalente a 10 MB.
 * @constant {number}
 */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Tipos (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} NotificationAttachment
 * @property {string} name - Nome do arquivo anexado.
 * @property {number} size - Tamanho em bytes.
 */

/**
 * @typedef {Object} NotificationRecipients
 * @property {string[]} to  - Destinatários principais.
 * @property {string[]} cc  - Destinatários em cópia (Carbon Copy).
 * @property {string[]} bcc - Destinatários em cópia oculta (Blind Carbon Copy).
 */

/**
 * @typedef {Object} Notification
 * @property {string}                   id                - Identificador único (UUID).
 * @property {NotificationChannel}      channel           - Canal de envio.
 * @property {NotificationStatus}       status            - Status atual da notificação.
 * @property {string}                   templateId        - ID do template a ser usado. Obrigatório.
 * @property {string|null}              templateVersionId - ID da versão do template. null = mais recente.
 * @property {NotificationRecipients}   recipients        - Destinatários organizados por tipo.
 * @property {Record<string, string>}   variables         - Mapa de chave→valor para preencher as lacunas do template.
 * @property {NotificationAttachment[]} attachments       - Arquivos anexados (somente EMAIL suporta).
 * @property {string|null}              scheduledAt       - ISO 8601 com offset para envio futuro (ex:
 *                                                          "2026-05-07T15:00:00-03:00" ou "2026-05-07T18:00:00Z");
 *                                                          null = envio imediato.
 * @property {string|null}              sentAt            - ISO 8601 preenchido após envio com sucesso.
 * @property {string|null}              error             - Mensagem de erro do último envio falho.
 * @property {string}                   createdBy         - ID do usuário ou serviço que originou a notificação.
 * @property {string}                   createdAt         - ISO 8601 de criação do registro.
 */

/**
 * @typedef {Object} NotificationValidationResult
 * @property {boolean}  valid  - true se o modelo é válido.
 * @property {string[]} errors - Lista de mensagens de erro encontradas.
 */

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Regex básica de validação de e-mail. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida um endereço de e-mail.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

/**
 * Calcula o somatório de bytes de todos os anexos.
 * @param {NotificationAttachment[]} attachments
 * @returns {number}
 */
function totalAttachmentSize(attachments) {
  return attachments.reduce((sum, a) => sum + (Number(a.size) || 0), 0);
}

/**
 * Serializa uma data para ISO 8601 com offset UTC explícito ("Z").
 *
 * O backend espera `OffsetDateTime` — um valor sem offset (ex: "2026-05-07T15:00:00",
 * produzido por `<input type="datetime-local">`) seria interpretado ambiguamente.
 * Esta função garante que o offset UTC seja sempre declarado no payload enviado à API.
 *
 * @param {Date|string} date - Data a serializar. Strings sem offset são interpretadas
 *                             como horário local do navegador e convertidas para UTC.
 * @returns {string} ISO 8601 com sufixo "Z" (ex: "2026-05-07T18:00:00.000Z").
 *
 * @example
 * // Usuário em UTC-3 seleciona "15:00" num datetime-local:
 * serializeScheduledAt(new Date('2026-05-07T15:00'))
 * // → "2026-05-07T18:00:00.000Z"  (convertido para UTC automaticamente)
 */
export function serializeScheduledAt(date) {
  if (!date) return null;
  return new Date(date).toISOString(); // sempre retorna UTC com "Z"
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Cria um objeto Notification com valores padrão seguros.
 *
 * @param {Partial<Notification>} [data={}] - Dados parciais da notificação.
 * @returns {Readonly<Notification>}
 *
 * @example
 * const notification = createNotification({
 *   channel: NotificationChannel.EMAIL,
 *   templateId: 'tpl-boas-vindas',
 *   recipients: { to: ['cliente@example.com'] },
 *   variables: { userName: 'Maria', orderCode: '#42' },
 * });
 */
export function createNotification(data = {}) {
  const recipients = {
    to:  Array.isArray(data.recipients?.to)  ? [...data.recipients.to]  : [],
    cc:  Array.isArray(data.recipients?.cc)  ? [...data.recipients.cc]  : [],
    bcc: Array.isArray(data.recipients?.bcc) ? [...data.recipients.bcc] : [],
  };

  return Object.freeze({
    id:                data.id                ?? '',
    channel:           data.channel           ?? NotificationChannel.EMAIL,
    status:            data.status            ?? NotificationStatus.PENDING,
    templateId:        data.templateId        ?? '',
    templateVersionId: data.templateVersionId ?? null,
    recipients:        Object.freeze(recipients),
    variables:         Object.freeze(
                         data.variables && typeof data.variables === 'object'
                           ? { ...data.variables }
                           : {}
                       ),
    attachments:       Array.isArray(data.attachments)
                         ? data.attachments.map(a => Object.freeze({ name: a.name ?? '', size: Number(a.size) || 0 }))
                         : [],
    scheduledAt:       data.scheduledAt ?? null,
    sentAt:            data.sentAt      ?? null,
    error:             data.error       ?? null,
    createdBy:         data.createdBy   ?? '',
    createdAt:         data.createdAt   ?? new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Valida um objeto Notification.
 *
 * Regras verificadas:
 * - `templateId` obrigatório.
 * - `channel` deve ser valor de `NotificationChannel`.
 * - `status` deve ser valor de `NotificationStatus`.
 * - `recipients.to` deve ter ao menos 1 endereço válido (para EMAIL).
 * - Todos os e-mails em to/cc/bcc devem ter formato válido (para EMAIL).
 * - Soma dos anexos não pode ultrapassar `MAX_ATTACHMENT_SIZE_BYTES`.
 * - `createdBy` obrigatório.
 * - Se `scheduledAt` for fornecido, deve representar data futura e ser parseável como Date.
 *
 * @param {Notification} notification
 * @returns {NotificationValidationResult}
 */
export function validateNotification(notification) {
  const errors = [];

  // templateId
  if (!notification.templateId || notification.templateId.trim() === '') {
    errors.push('templateId: campo obrigatório.');
  }

  // recipients — validação de e-mail somente para canal EMAIL
  if (notification.channel === NotificationChannel.EMAIL) {
    const { to = [], cc = [], bcc = [] } = notification.recipients ?? {};

    if (to.length === 0) {
      errors.push('recipients.to: ao menos um destinatário é obrigatório.');
    }

    [...to, ...cc, ...bcc].forEach(address => {
      if (!isValidEmail(address)) {
        errors.push(`recipients: "${address}" não é um endereço de e-mail válido.`);
      }
    });
  }

  // attachments — limite de 10 MB
  if (notification.attachments?.length > 0) {
    const total = totalAttachmentSize(notification.attachments);
    if (total > MAX_ATTACHMENT_SIZE_BYTES) {
      const totalMB = (total / (1024 * 1024)).toFixed(2);
      errors.push(
        `attachments: tamanho total (${totalMB} MB) excede o limite de 10 MB.`
      );
    }
  }

  // scheduledAt — deve ser uma data futura, se fornecida.
  //
  // O valor aceito é qualquer string parseável por `new Date()`, incluindo:
  //   - ISO 8601 com offset:  "2026-05-07T15:00:00-03:00"
  //   - ISO 8601 UTC (Z):     "2026-05-07T18:00:00.000Z"  ← formato de serializeScheduledAt()
  //   - datetime-local cru:   "2026-05-07T15:00"  (interpretado como horário local do navegador)
  //
  // Ao montar o payload para a API, sempre use `serializeScheduledAt()` para garantir
  // que o offset UTC seja declarado explicitamente no JSON enviado ao backend.
  if (notification.scheduledAt !== null && notification.scheduledAt !== undefined) {
    const scheduledDate = new Date(notification.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      errors.push('scheduledAt: formato de data inválido. Use serializeScheduledAt() para serializar datas.');
    } else if (scheduledDate <= new Date()) {
      errors.push('scheduledAt: deve ser uma data/hora no futuro.');
    }
  }

  return { valid: errors.length === 0, errors };
}