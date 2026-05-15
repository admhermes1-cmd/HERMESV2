import apiClient from '@/core/api/apiClient'
import { ENDPOINTS } from '@/core/api/apiEndpoints'

/**
 * @typedef {Object} DashboardStats
 * @property {number} sent        - Total de notificações enviadas com sucesso
 * @property {number} failed      - Total de notificações com falha
 * @property {number} scheduled   - Total de notificações agendadas (futuras)
 * @property {number} pending     - Total de notificações aguardando processamento
 * @property {number} totalToday  - Total de notificações do dia (todos os status)
 * @property {number} successRate - Taxa de sucesso em percentual (0–100)
 */

/**
 * @typedef {Object} LogEntry
 * @property {string|number} id         - Identificador único do log
 * @property {'INFO'|'WARN'|'ERROR'} level - Nível de severidade
 * @property {string}        message    - Mensagem descritiva do evento
 * @property {Object}        context    - Dados contextuais adicionais do evento
 * @property {string}        createdAt  - Data/hora ISO 8601 de criação
 */

/**
 * @typedef {Object} PaginatedLogs
 * @property {LogEntry[]} data  - Entradas de log da página atual
 * @property {number}     total - Total de registros disponíveis
 * @property {number}     page  - Página atual
 * @property {number}     limit - Itens por página
 */

/**
 * Retorna as estatísticas agregadas do dashboard.
 *
 * @returns {Promise<DashboardStats>}
 * @throws {AppError}
 */
const getStats = () =>
  apiClient.get(ENDPOINTS.DASHBOARD.STATS)

/**
 * Lista os logs do sistema com suporte a paginação e filtro por nível.
 *
 * @param {Object}             [options]        - Opções de listagem
 * @param {number}             [options.page]   - Número da página (base 1)
 * @param {number}             [options.limit]  - Quantidade de itens por página
 * @param {'INFO'|'WARN'|'ERROR'} [options.level] - Filtro por nível de severidade
 * @param {AbortSignal}        [options.signal] - Sinal para cancelamento da requisição
 * @returns {Promise<PaginatedLogs>}
 * @throws {AppError}
 */
const getLogs = ({ page, limit, level, signal } = {}) => {
  const params = {}
  if (page  !== undefined) params.page  = page
  if (limit !== undefined) params.limit = limit
  if (level !== undefined) params.level = level

  return apiClient.get(ENDPOINTS.DASHBOARD.LOGS, { params, signal })
}

export const dashboardService = {
  getStats,
  getLogs,
}