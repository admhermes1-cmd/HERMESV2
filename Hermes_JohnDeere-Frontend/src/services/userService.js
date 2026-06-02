import apiClient          from '../core/api/apiClient';
import { ENDPOINTS }     from '../core/api/apiEndpoints';

/**
 * Extrai a mensagem de erro de uma resposta Axios,
 * com fallback para mensagem genérica.
 *
 * @param {unknown} err - Erro capturado no catch.
 * @returns {Error} Erro normalizado com `message` e `status`.
 */
function toServiceError(err) {
  const message =
    err?.response?.data?.message ??
    err?.message ??
    'Ocorreu um erro inesperado.';
  const error = new Error(message);
  error.status = err?.response?.status ?? 0;
  return error;
}

/**
 * Serviço de acesso à API para o módulo de usuários.
 *
 * <p>Toda a comunicação HTTP é feita via {@link apiClient}, que centraliza
 * autenticação, refresh de token e tratamento global de erros.
 * Os erros da API são normalizados por {@link toServiceError} antes de
 * serem propagados ao ViewModel.</p>
 */
export const userService = Object.freeze({

  /**
   * Retorna uma página de usuários com filtros opcionais.
   *
   * @param {{ page?: number, limit?: number, role?: string, isActive?: string }} params
   * @param {AbortSignal} [signal] - Sinal para cancelamento da requisição.
   * @returns {Promise<Object>} Página de usuários.
   */
  async listUsers(params = {}, signal) {
    try {
      return await apiClient.get(ENDPOINTS.USERS.LIST, { params, signal });
    } catch (err) {
      throw toServiceError(err);
    }
  },

  /**
   * Retorna os dados completos de um usuário pelo ID.
   *
   * @param {string} id - UUID do usuário.
   * @param {AbortSignal} [signal] - Sinal para cancelamento da requisição.
   * @returns {Promise<Object>} Dados do usuário.
   */
  async findById(id, signal) {
    try {
      return await apiClient.get(ENDPOINTS.USERS.BY_ID(id), { signal });
    } catch (err) {
      throw toServiceError(err);
    }
  },

  /**
   * Cria um novo usuário. A senha é gerada pelo backend e enviada por e-mail.
   *
   * @param {{ name: string, email: string, role: string, isActive?: boolean }} payload
   * @returns {Promise<Object>} Dados do usuário criado.
   */
  async createUser(payload) {
    try {
      return await apiClient.post(ENDPOINTS.USERS.LIST, payload);
    } catch (err) {
      throw toServiceError(err);
    }
  },

  /**
   * Atualiza os dados de um usuário existente (name, role, isActive).
   *
   * @param {string} id - UUID do usuário.
   * @param {{ name: string, role: string, isActive: boolean }} payload
   * @returns {Promise<Object>} Dados do usuário atualizado.
   */
  async updateUser(id, payload) {
    try {
      return await apiClient.put(ENDPOINTS.USERS.BY_ID(id), payload);
    } catch (err) {
      throw toServiceError(err);
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
      await apiClient.post(ENDPOINTS.USERS.RESET_PASSWORD(id));
    } catch (err) {
      throw toServiceError(err);
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
      await apiClient.delete(ENDPOINTS.USERS.BY_ID(id));
    } catch (err) {
      throw toServiceError(err);
    }
  },
});
