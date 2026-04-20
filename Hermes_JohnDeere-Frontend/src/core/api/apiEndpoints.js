/**
 * @file apiEndpoints.js
 * @module core/api/apiEndpoints
 * @description Mapa centralizado e tipado de todos os endpoints da API HERMES.
 *
 * Princípios de design:
 *  - **Single source of truth**: Nenhum service deve ter strings de URL hardcoded.
 *    Qualquer mudança de rota é feita aqui e propagada automaticamente.
 *  - **Funções para rotas parametrizadas**: Endpoints com `:id` ou múltiplos parâmetros
 *    são representados como funções puras que recebem os parâmetros e retornam a URL.
 *  - **Organização por domínio**: `AUTH`, `TEMPLATES`, `NOTIFICATIONS`, `DASHBOARD`.
 *
 * @example
 * import { ENDPOINTS } from '@/core/api/apiEndpoints'
 *
 * // Rota estática:
 * apiClient.get(ENDPOINTS.AUTH.ME)
 *
 * // Rota com parâmetro:
 * apiClient.get(ENDPOINTS.TEMPLATES.BY_ID('abc123'))
 *
 * // Rota aninhada com dois parâmetros:
 * apiClient.put(ENDPOINTS.TEMPLATES.VERSION_BY_ID('abc123', 'v2'))
 */

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

/**
 * @namespace AUTH
 * @description Endpoints de autenticação e gerenciamento de sessão.
 */
const AUTH = Object.freeze({
  /**
   * Autentica o usuário e retorna access token + refresh token.
   * @type {string}
   * @method POST
   * @body {{ email: string, password: string }}
   * @returns {{ accessToken: string, refreshToken?: string, user: object }}
   */
  LOGIN: '/auth/login',

  /**
   * Encerra a sessão atual e invalida o token no backend.
   * @type {string}
   * @method POST
   */
  LOGOUT: '/auth/logout',

  /**
   * Obtém um novo access token a partir do refresh token (geralmente em cookie HttpOnly).
   * @type {string}
   * @method POST
   * @returns {{ accessToken: string }}
   */
  REFRESH: '/auth/refresh',

  /**
   * Retorna os dados do usuário autenticado atualmente.
   * @type {string}
   * @method GET
   * @returns {import('@/models/User').User}
   */
  ME: '/auth/me',
})

// ---------------------------------------------------------------------------
// TEMPLATES
// ---------------------------------------------------------------------------

/**
 * @namespace TEMPLATES
 * @description Endpoints de gerenciamento de templates de comunicação.
 */
const TEMPLATES = Object.freeze({
  /**
   * Lista todos os templates com suporte a paginação e filtros.
   * @type {string}
   * @method GET
   * @query {{ page?: number, limit?: number, channel?: string }}
   * @returns {{ data: import('@/models/Template').Template[], total: number, page: number, limit: number }}
   */
  LIST: '/templates',

  /**
   * Cria um novo template.
   * @type {string}
   * @method POST
   * @body {Omit<import('@/models/Template').Template, 'id' | 'createdAt' | 'updatedAt'>}
   * @returns {import('@/models/Template').Template}
   */
  CREATE: '/templates',

  /**
   * Retorna um template específico pelo ID.
   * @param {string} id - ID do template
   * @returns {string} URL do endpoint
   * @method GET
   *
   * @example
   * apiClient.get(ENDPOINTS.TEMPLATES.BY_ID('abc123'))
   */
  BY_ID: (id) => `/templates/${id}`,

  /**
   * Atualiza um template existente.
   * @param {string} id - ID do template a atualizar
   * @returns {string} URL do endpoint
   * @method PUT
   *
   * @example
   * apiClient.put(ENDPOINTS.TEMPLATES.UPDATE('abc123'), payload)
   */
  UPDATE: (id) => `/templates/${id}`,

  /**
   * Remove um template pelo ID.
   * @param {string} id - ID do template a excluir
   * @returns {string} URL do endpoint
   * @method DELETE
   *
   * @example
   * apiClient.delete(ENDPOINTS.TEMPLATES.DELETE('abc123'))
   */
  DELETE: (id) => `/templates/${id}`,

  /**
   * Lista todas as versões de um template específico.
   * @param {string} templateId - ID do template pai
   * @returns {string} URL do endpoint
   * @method GET
   *
   * @example
   * apiClient.get(ENDPOINTS.TEMPLATES.VERSIONS('abc123'))
   */
  VERSIONS: (templateId) => `/templates/${templateId}/versions`,

  /**
   * Cria uma nova versão para um template existente.
   * @param {string} templateId - ID do template pai
   * @returns {string} URL do endpoint
   * @method POST
   *
   * @example
   * apiClient.post(ENDPOINTS.TEMPLATES.CREATE_VERSION('abc123'), versionPayload)
   */
  CREATE_VERSION: (templateId) => `/templates/${templateId}/versions`,

  /**
   * Atualiza uma versão específica de um template.
   * @param {string} templateId - ID do template pai
   * @param {string} versionId - ID da versão a atualizar
   * @returns {string} URL do endpoint
   * @method PUT
   *
   * @example
   * apiClient.put(ENDPOINTS.TEMPLATES.VERSION_BY_ID('abc123', 'v2'), versionPayload)
   */
  VERSION_BY_ID: (templateId, versionId) => `/templates/${templateId}/versions/${versionId}`,
})

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------

/**
 * @namespace NOTIFICATIONS
 * @description Endpoints de envio, consulta e gerenciamento de notificações.
 */
const NOTIFICATIONS = Object.freeze({
  /**
   * Lista notificações com suporte a paginação e filtros de status e canal.
   * @type {string}
   * @method GET
   * @query {{ page?: number, limit?: number, status?: string, channel?: string }}
   * @returns {{ data: import('@/models/Notification').Notification[], total: number, page: number, limit: number }}
   */
  LIST: '/notifications',

  /**
   * Envia uma nova notificação.
   * Se o campo `scheduledAt` estiver presente no body, a notificação será agendada;
   * caso contrário, será enviada imediatamente.
   * @type {string}
   * @method POST
   * @body {{ templateId: string, channel: string, recipient: string, payload: object, scheduledAt?: string }}
   * @returns {import('@/models/Notification').Notification}
   */
  SEND: '/notifications',

  /**
   * Retorna os detalhes de uma notificação específica.
   * @param {string} id - ID da notificação
   * @returns {string} URL do endpoint
   * @method GET
   *
   * @example
   * apiClient.get(ENDPOINTS.NOTIFICATIONS.BY_ID('notif-456'))
   */
  BY_ID: (id) => `/notifications/${id}`,

  /**
   * Cancela o envio de uma notificação agendada.
   * Só é possível cancelar notificações com status `SCHEDULED`.
   * @param {string} id - ID da notificação agendada
   * @returns {string} URL do endpoint
   * @method POST
   *
   * @example
   * apiClient.post(ENDPOINTS.NOTIFICATIONS.CANCEL('notif-456'))
   */
  CANCEL: (id) => `/notifications/${id}/cancel`,

  /**
   * Retenta o envio de uma notificação que falhou.
   * Só é possível retentar notificações com status `FAILED`.
   * @param {string} id - ID da notificação com falha
   * @returns {string} URL do endpoint
   * @method POST
   *
   * @example
   * apiClient.post(ENDPOINTS.NOTIFICATIONS.RETRY('notif-456'))
   */
  RETRY: (id) => `/notifications/${id}/retry`,
})

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

/**
 * @namespace DASHBOARD
 * @description Endpoints de métricas e logs operacionais do HERMES.
 */
const DASHBOARD = Object.freeze({
  /**
   * Retorna os totais de notificações por status: enviadas, falhas, agendadas e pendentes.
   * @type {string}
   * @method GET
   * @returns {{ sent: number, failed: number, scheduled: number, pending: number }}
   */
  STATS: '/dashboard/stats',

  /**
   * Retorna os logs operacionais da plataforma com suporte a paginação e filtro por nível.
   * @type {string}
   * @method GET
   * @query {{ page?: number, limit?: number, level?: 'info' | 'warn' | 'error' }}
   * @returns {{ data: object[], total: number, page: number, limit: number }}
   */
  LOGS: '/dashboard/logs',
})

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

/**
 * Mapa centralizado de todos os endpoints da API HERMES.
 * Sempre importe daqui — nunca escreva URLs de endpoint diretamente nos services.
 *
 * @type {{ AUTH: typeof AUTH, TEMPLATES: typeof TEMPLATES, NOTIFICATIONS: typeof NOTIFICATIONS, DASHBOARD: typeof DASHBOARD }}
 *
 * @example
 * import { ENDPOINTS } from '@/core/api/apiEndpoints'
 *
 * ENDPOINTS.AUTH.LOGIN          // '/auth/login'
 * ENDPOINTS.TEMPLATES.BY_ID('x') // '/templates/x'
 * ENDPOINTS.NOTIFICATIONS.RETRY('y') // '/notifications/y/retry'
 */
export const ENDPOINTS = Object.freeze({
  AUTH,
  TEMPLATES,
  NOTIFICATIONS,
  DASHBOARD,
})