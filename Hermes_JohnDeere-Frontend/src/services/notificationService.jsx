import apiClient from '@/core/api/apiClient'
import { ENDPOINTS } from '@/core/api/apiEndpoints'

/**
 * @typedef {import('@/models/Notification').Notification}       Notification
 * @typedef {import('@/models/Notification').NotificationStatus} NotificationStatus
 * @typedef {import('@/models/Notification').NotificationChannel} NotificationChannel
 */

/**
 * @typedef {Object} PaginatedNotifications
 * @property {Notification[]} data  - Lista de notificações da página atual
 * @property {number}         total - Total de registros disponíveis
 * @property {number}         page  - Página atual
 * @property {number}         limit - Itens por página
 */

/**
 * @typedef {Object} BulkSuccessItem
 * @property {number}      line  - Número da linha no arquivo original (1-based)
 * @property {string}      email - E-mail do destinatário
 * @property {string|null} name  - Nome do destinatário, se disponível
 */

/**
 * @typedef {Object} BulkFailureItem
 * @property {number}      line   - Número da linha no arquivo original (1-based)
 * @property {string|null} email  - E-mail do destinatário (null se a coluna estava ausente)
 * @property {string}      reason - Descrição legível da causa da falha
 */

/**
 * @typedef {Object} BulkNotificationResultDTO
 * @property {number}           total      - Total de registros encontrados no arquivo
 * @property {number}           successful - Quantidade de envios bem-sucedidos
 * @property {number}           failed     - Quantidade de envios que falharam
 * @property {BulkSuccessItem[]} successes - Detalhes dos envios bem-sucedidos
 * @property {BulkFailureItem[]} failures  - Detalhes dos envios que falharam, com motivo
 */

/**
 * Lista notificações com suporte a paginação e filtros opcionais.
 *
 * @param {Object}               [options]          - Opções de listagem
 * @param {number}               [options.page]     - Número da página (base 1)
 * @param {number}               [options.limit]    - Quantidade de itens por página
 * @param {NotificationStatus}   [options.status]   - Filtro por status
 * @param {NotificationChannel}  [options.channel]  - Filtro por canal
 * @param {AbortSignal}          [options.signal]   - Sinal para cancelamento da requisição
 * @returns {Promise<PaginatedNotifications>}
 * @throws {AppError}
 */
const listNotifications = ({ page, limit, status, channel, signal } = {}) => {
  const params = {}
  if (page    !== undefined) params.page    = page
  if (limit   !== undefined) params.limit   = limit
  if (status  !== undefined) params.status  = status
  if (channel !== undefined) params.channel = channel

  return apiClient.get(ENDPOINTS.NOTIFICATIONS.LIST, { params, signal })
}

/**
 * Busca uma notificação pelo ID.
 *
 * @param {string|number} id - Identificador da notificação
 * @returns {Promise<Notification>}
 * @throws {AppError} Quando a notificação não for encontrada (404)
 */
const getNotification = (id) =>
  apiClient.get(ENDPOINTS.NOTIFICATIONS.BY_ID(id))

/**
 * Envia uma notificação imediata ou agendada.
 *
 * Regras de envio:
 * - Se `notificationData.scheduledAt` estiver ausente ou null, o envio é imediato.
 * - Se `notificationData.scheduledAt` estiver preenchido, a notificação é agendada.
 * - Se `notificationData.templateVersionId` não for informado, o backend usa a versão mais recente.
 * - O total de anexos não deve ultrapassar 10 MB.
 *
 * Quando há anexos, a requisição é enviada como `multipart/form-data`.
 * Caso contrário, é enviada como `application/json`.
 *
 * @param {Partial<Notification>} notificationData       - Dados da notificação
 * @param {File[]}                [attachments=[]]       - Arquivos a anexar (máx. 10 MB total)
 * @returns {Promise<Notification>}
 * @throws {AppError}
 */
const sendNotification = (notificationData, attachments = []) => {
  const formData = new FormData()

  // O backend exige multipart/form-data com o campo "request" contendo o JSON
  // (@RequestPart("request") no NotificationController)
  formData.append(
    'request',
    new Blob([JSON.stringify(notificationData)], { type: 'application/json' }),
    'request.json'
  )
  if (attachments && attachments.length > 0) {
    attachments.forEach((file) => {
      formData.append('attachments', file, file.name)
    })
  }

  return apiClient.post(ENDPOINTS.NOTIFICATIONS.SEND, formData)
}

/**
 * Envia um arquivo CSV ou JSON para processamento de notificações em massa.
 *
 * Cada linha do arquivo representa um destinatário independente. Falhas
 * individuais não interrompem o processamento das demais linhas — o resultado
 * traz uma lista detalhada de sucessos e falhas por linha.
 *
 * O `FormData` deve ser montado pelo ViewModel com os campos:
 * - `templateId`        (UUID, obrigatório)
 * - `templateVersionId` (UUID, opcional)
 * - `channel`           (string, obrigatório — ex: "EMAIL")
 * - `file`              (File, obrigatório — .csv ou .json, máx. 5 MB, 200 linhas)
 * - `scheduledAt`       (ISO-8601 com offset, opcional)
 *
 * O header `Content-Type: multipart/form-data` não é definido manualmente —
 * o browser o define automaticamente com o boundary correto ao receber um FormData.
 *
 * @param {FormData} formData - Dados do formulário de envio em massa
 * @returns {Promise<BulkNotificationResultDTO>}
 * @throws {AppError} 400 se o arquivo for inválido, vazio, muito grande ou exceder 200 registros
 * @throws {AppError} 404 se o template ou versão não for encontrado
 *
 * @example
 * const formData = new FormData()
 * formData.append('templateId', '550e8400-e29b-41d4-a716-446655440000')
 * formData.append('channel', 'EMAIL')
 * formData.append('file', csvFile)
 * const result = await notificationService.sendBulkNotification(formData)
 * console.log(`${result.successful} enviados, ${result.failed} falhas`)
 */
const sendBulkNotification = (formData) =>
  apiClient.post(ENDPOINTS.NOTIFICATIONS.BULK_SEND, formData)

/**
 * Cancela uma notificação pendente ou agendada.
 *
 * @param {string|number} id - Identificador da notificação
 * @returns {Promise<Notification>} Notificação atualizada com status cancelado
 * @throws {AppError} Quando a notificação não puder ser cancelada
 */
const cancelNotification = (id) =>
  apiClient.post(ENDPOINTS.NOTIFICATIONS.CANCEL(id))

/**
 * Reenvia uma notificação com falha (quando `canRetry` for verdadeiro).
 *
 * @param {string|number} id - Identificador da notificação
 * @returns {Promise<Notification>} Notificação atualizada com novo status
 * @throws {AppError} Quando a notificação não for elegível para reenvio
 */
const retryNotification = (id) =>
  apiClient.post(ENDPOINTS.NOTIFICATIONS.RETRY(id))

export const notificationService = {
  listNotifications,
  getNotification,
  sendNotification,
  sendBulkNotification,
  cancelNotification,
  retryNotification,
}
