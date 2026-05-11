import apiClient from '@/core/api/apiClient'
import { ENDPOINTS } from '@/core/api/apiEndpoints'

/**
 * @typedef {import('@/models/User').User} User
 */

/**
 * Realiza login com e-mail e senha.
 *
 * @param {{ email: string, password: string }} credentials - Credenciais do usuário
 * @returns {Promise<{ user: User, token: string, refreshToken: string }>}
 * @throws {AppError} Em caso de credenciais inválidas ou falha de rede
 */
const login = ({ email, password }) =>
  apiClient.post(ENDPOINTS.AUTH.LOGIN, { email, password })

/**
 * Encerra a sessão do usuário autenticado.
 *
 * @returns {Promise<void>}
 * @throws {AppError} Em caso de falha de rede ou token inválido
 */
const logout = () =>
  apiClient.post(ENDPOINTS.AUTH.LOGOUT)

/**
 * Renova o token de acesso utilizando o refresh token.
 *
 * @param {string} refreshToken - Token de renovação emitido no login
 * @returns {Promise<{ token: string, refreshToken: string }>}
 * @throws {AppError} Em caso de refresh token expirado ou inválido
 */
const refreshToken = (refreshToken) =>
  apiClient.post(ENDPOINTS.AUTH.REFRESH, { refreshToken })

/**
 * Retorna os dados do usuário autenticado a partir do token vigente.
 *
 * @returns {Promise<User>}
 * @throws {AppError} Em caso de token inválido ou expirado
 */
const getMe = () =>
  apiClient.get(ENDPOINTS.AUTH.ME)

/**
 * Envia a troca de senha para o endpoint POST /auth/change-password.
 *
 * @param {{ currentPassword: string, newPassword: string }} payload
 * @returns {Promise<void>}
 */
async changePassword(payload) {
  try {
    await apiClient.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, payload);
  } catch (err) {
    throw toServiceError(err);
  }
},

export const authService = {
  login,
  logout,
  refreshToken,
  getMe,
}
