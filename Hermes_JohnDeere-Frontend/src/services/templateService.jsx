import apiClient from '@/core/api/apiClient'
import { ENDPOINTS } from '@/core/api/apiEndpoints'

/**
 * @typedef {import('@/models/Template').Template} Template
 * @typedef {import('@/models/Template').TemplateVersion} TemplateVersion
 * @typedef {import('@/models/Template').TemplateChannel} TemplateChannel
 */

/**
 * @typedef {Object} PaginatedTemplates
 * @property {Template[]} data     - Lista de templates da página atual
 * @property {number}     total    - Total de registros disponíveis
 * @property {number}     page     - Página atual
 * @property {number}     limit    - Itens por página
 */

/**
 * Lista templates com suporte a paginação e filtro por canal.
 *
 * @param {Object}        [options]          - Opções de listagem
 * @param {number}        [options.page]     - Número da página (base 1)
 * @param {number}        [options.limit]    - Quantidade de itens por página
 * @param {TemplateChannel} [options.channel] - Filtro por canal (EMAIL, SMS, WHATSAPP…)
 * @param {AbortSignal}   [options.signal]   - Sinal para cancelamento da requisição
 * @returns {Promise<PaginatedTemplates>}
 * @throws {AppError}
 */
const listTemplates = ({ page, limit, channel, signal } = {}) => {
  const params = {}
  if (page    !== undefined) params.page    = page
  if (limit   !== undefined) params.limit   = limit
  if (channel !== undefined) params.channel = channel

  return apiClient.get(ENDPOINTS.TEMPLATES.LIST, { params, signal })
}

/**
 * Busca um template pelo ID, com suas versões populadas.
 *
 * @param {string|number} id - Identificador do template
 * @returns {Promise<Template>}
 * @throws {AppError} Quando o template não for encontrado (404)
 */
const getTemplate = (id) =>
  apiClient.get(ENDPOINTS.TEMPLATES.BY_ID(id))

/**
 * Cria um novo template.
 *
 * @param {Partial<Template>} templateData - Dados do template a ser criado
 * @returns {Promise<Template>}
 * @throws {AppError}
 */
const createTemplate = (templateData) =>
  apiClient.post(ENDPOINTS.TEMPLATES.CREATE, templateData)

/**
 * Atualiza um template existente.
 *
 * @param {string|number}    id           - Identificador do template
 * @param {Partial<Template>} templateData - Campos a serem atualizados
 * @returns {Promise<Template>}
 * @throws {AppError} Quando o template não for encontrado (404)
 */
const updateTemplate = (id, templateData) =>
  apiClient.put(ENDPOINTS.TEMPLATES.BY_ID(id), templateData)

/**
 * Remove um template pelo ID.
 *
 * @param {string|number} id - Identificador do template
 * @returns {Promise<void>}
 * @throws {AppError} Quando o template não for encontrado (404)
 */
const deleteTemplate = (id) =>
  apiClient.delete(ENDPOINTS.TEMPLATES.BY_ID(id))

/**
 * Lista todas as versões de um template.
 *
 * @param {string|number} templateId - Identificador do template pai
 * @returns {Promise<TemplateVersion[]>}
 * @throws {AppError}
 */
const listVersions = (templateId) =>
  apiClient.get(ENDPOINTS.TEMPLATES.VERSIONS(templateId))

/**
 * Cria uma nova versão para um template existente.
 *
 * @param {string|number}           templateId   - Identificador do template pai
 * @param {Partial<TemplateVersion>} versionData  - Dados da nova versão
 * @returns {Promise<TemplateVersion>}
 * @throws {AppError}
 */
const createVersion = (templateId, versionData) =>
  apiClient.post(ENDPOINTS.TEMPLATES.VERSIONS(templateId), versionData)

/**
 * Atualiza uma versão específica de um template.
 *
 * @param {string|number}           templateId  - Identificador do template pai
 * @param {string|number}           versionId   - Identificador da versão
 * @param {Partial<TemplateVersion>} versionData - Campos a serem atualizados
 * @returns {Promise<TemplateVersion>}
 * @throws {AppError} Quando o template ou a versão não forem encontrados (404)
 */
const updateVersion = (templateId, versionId, versionData) =>
  apiClient.put(ENDPOINTS.TEMPLATES.VERSION_BY_ID(templateId, versionId), versionData)

export const templateService = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listVersions,
  createVersion,
  updateVersion,
}