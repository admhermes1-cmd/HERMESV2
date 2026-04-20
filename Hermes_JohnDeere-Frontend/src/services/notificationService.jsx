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

  return apiClient.get(ENDPOINTS.NOTIFICATIONS.BASE, { params, signal })
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
  if (attachments.length === 0) {
    return apiClient.post(ENDPOINTS.NOTIFICATIONS.BASE, notificationData)
  }

  const formData = new FormData()

  // Serializa o payload principal como campo JSON dentro do FormData
  formData.append('data', JSON.stringify(notificationData))

  attachments.forEach((file) => {
    formData.append('attachments', file, file.name)
  })

  return apiClient.post(ENDPOINTS.NOTIFICATIONS.BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

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
  cancelNotification,
  retryNotification,
}