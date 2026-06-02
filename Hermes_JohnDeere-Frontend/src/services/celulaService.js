/**
 * @fileoverview celulaService.js — Camada de acesso à API REST de células.
 *
 * Segue o mesmo padrão do userService: delega ao apiClient (que já extrai
 * response.data via interceptor) e nunca faz double-extraction.
 *
 * @module services/celulaService
 */

import apiClient from '../core/api/apiClient';
import { ENDPOINTS } from '../core/constants/appConstants';

/**
 * @typedef {Object} CelulaResponseDTO
 * @property {string}       id            - UUID da célula.
 * @property {string}       nome          - Nome da célula.
 * @property {GestorDTO}    gestor        - Dados do gestor.
 * @property {number}       totalUsuarios - Total de usuários vinculados.
 * @property {string}       createdAt     - ISO date string.
 */

/**
 * @typedef {Object} CelulaDetalheDTO
 * @property {string}                id        - UUID da célula.
 * @property {string}                nome      - Nome da célula.
 * @property {GestorDTO}             gestor    - Dados do gestor.
 * @property {UserListResponseDTO[]} usuarios  - Usuários vinculados.
 * @property {string}                createdAt - ISO date string.
 * @property {string}                updatedAt - ISO date string.
 */

/**
 * @typedef {Object} CelulaRequestDTO
 * @property {string} nome     - Nome da célula.
 * @property {string} gestorId - UUID do gestor (deve ter role GESTOR).
 */

export const celulaService = {

  /**
   * Retorna uma página de células.
   *
   * @param {object} params
   * @param {number} [params.page=1]    - Página (1-based).
   * @param {number} [params.limit=20]  - Itens por página.
   * @param {AbortSignal} [signal]      - Sinal para cancelamento da requisição.
   * @returns {Promise<PageResponseDTO<CelulaResponseDTO>>}
   */
  listCelulas({ page = 1, limit = 20 } = {}, signal) {
    return apiClient.get(ENDPOINTS.CELULAS.BASE, {
      params: { page, limit },
      signal,
    });
  },

  /**
   * Retorna os detalhes completos de uma célula pelo id.
   *
   * @param {string}      id     - UUID da célula.
   * @param {AbortSignal} [signal]
   * @returns {Promise<CelulaDetalheDTO>}
   */
  findById(id, signal) {
    return apiClient.get(ENDPOINTS.CELULAS.BY_ID(id), { signal });
  },

  /**
   * Retorna a lista de usuários vinculados a uma célula.
   *
   * @param {string}      id     - UUID da célula.
   * @param {AbortSignal} [signal]
   * @returns {Promise<UserListResponseDTO[]>}
   */
  listUsuarios(id, signal) {
    return apiClient.get(ENDPOINTS.CELULAS.USUARIOS(id), { signal });
  },

  /**
   * Cria uma nova célula.
   *
   * @param {CelulaRequestDTO} data
   * @returns {Promise<CelulaResponseDTO>}
   */
  createCelula(data) {
    return apiClient.post(ENDPOINTS.CELULAS.BASE, data);
  },

  /**
   * Atualiza uma célula existente.
   *
   * @param {string}           id   - UUID da célula.
   * @param {CelulaRequestDTO} data
   * @returns {Promise<CelulaResponseDTO>}
   */
  updateCelula(id, data) {
    return apiClient.put(ENDPOINTS.CELULAS.BY_ID(id), data);
  },

  /**
   * Remove uma célula.
   *
   * @param {string} id - UUID da célula.
   * @returns {Promise<void>}
   */
  deleteCelula(id) {
    return apiClient.delete(ENDPOINTS.CELULAS.BY_ID(id));
  },
};
