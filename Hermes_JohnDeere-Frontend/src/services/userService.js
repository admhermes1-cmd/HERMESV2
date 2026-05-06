import { apiClient } from '../api/apiClient';
import { API_ENDPOINTS } from '../api/apiEndpoints';
import { AppError } from '../errors/AppError';

/**
 * Serviço de acesso à API para o módulo de usuários.
 *
 * <p>Toda a comunicação HTTP é feita via {@link apiClient}, que centraliza
 * autenticação, refresh de token e tratamento global de erros.
 * Os erros de negócio da API são normalizados em {@link AppError} antes de
 * serem propagados ao ViewModel.</p>
 */
export const userService = Object.freeze({

  /**
   * Retorna uma página de usuários com filtros opcionais.
   *
   * @param {{ page?: number, limit?: number, role?: string, isActive?: string }} params
   * @param {AbortSignal} [signal] - Sinal para cancelamento da requisição.
   * @returns {Promise<import('../../../types').PageResponse>}
   */
  async listUsers(params = {}, signal) {
    try {
      const response = await apiClient.get(API_ENDPOINTS.USERS.LIST, { params, signal });
      return response.data;
    } catch (err) {
      throw AppError.fromAxiosError(err);
    }
  },

  /**
   * Retorna os dados completos de um usuário pelo ID.
   *
   * @param {string} id     - UUID do usuário.
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('../../../types').UserResponse>}
   */
  async findById(id, signal) {
    try {
      const response = await apiClient.get(API_ENDPOINTS.USERS.BY_ID(id), { signal });
      return response.data;
    } catch (err) {
      throw AppError.fromAxiosError(err);
    }
  },

  /**
   * Cria um novo usuário. A senha é gerada pelo backend e enviada por e-mail.
   *
   * @param {{ name: string, email: string, role: string, isActive?: boolean }} payload
   * @returns {Promise<import('../../../types').UserResponse>}
   */
  async createUser(payload) {
    try {
      const response = await apiClient.post(API_ENDPOINTS.USERS.LIST, payload);
      return response.data;
    } catch (err) {
      throw AppError.fromAxiosError(err);
    }
  },

  /**
   * Atualiza os dados de um usuário existente (name, role, isActive).
   *
   * @param {string} id
   * @param {{ name: string, role: string, isActive: boolean }} payload
   * @returns {Promise<import('../../../types').UserResponse>}
   */
  async updateUser(id, payload) {
    try {
      const response = await apiClient.put(API_ENDPOINTS.USERS.BY_ID(id), payload);
      return response.data;
    } catch (err) {
      throw AppError.fromAxiosError(err);
    }
  },

  /**
   * Solicita redefinição de senha — o backend gera nova senha e envia por e-mail.
   *
   * @param {string} id - UUID do usuário.
   * @returns {Promise<void>}
   */
  async resetPassword(id) {
    try {
      await apiClient.post(API_ENDPOINTS.USERS.RESET_PASSWORD(id));
    } catch (err) {
      throw AppError.fromAxiosError(err);
    }
  },

  /**
   * Remove um usuário do sistema.
   *
   * @param {string} id - UUID do usuário.
   * @returns {Promise<void>}
   */
  async deleteUser(id) {
    try {
      await apiClient.delete(API_ENDPOINTS.USERS.BY_ID(id));
    } catch (err) {
      throw AppError.fromAxiosError(err);
    }
  },
});
