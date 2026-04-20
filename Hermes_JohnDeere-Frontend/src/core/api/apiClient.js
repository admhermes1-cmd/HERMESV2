/**
 * @file apiClient.js
 * @module core/api/apiClient
 * @description Instância centralizada do Axios para o projeto HERMES.
 *
 * Responsabilidades:
 *  - Criar e exportar a instância configurada do Axios (baseURL, timeout, headers)
 *  - Injetar token Bearer automaticamente em toda requisição autenticada
 *  - Normalizar respostas de sucesso, entregando `response.data` diretamente
 *  - Transformar todos os erros em `AppError` padronizado, nunca expondo erros brutos do Axios
 *  - Gerenciar refresh automático de token em respostas 401 com fila de requisições
 *  - Expor `onLogout(callback)` para registro de callback de logout sem dependência circular
 *
 * @example
 * // Em um service qualquer:
 * import apiClient from '@/core/api/apiClient'
 *
 * const data = await apiClient.get('/templates') // Já retorna data diretamente
 *
 * @example
 * // No AuthProvider, registrar o callback de logout:
 * import { onLogout } from '@/core/api/apiClient'
 * onLogout(() => dispatch({ type: 'LOGOUT' }))
 */

import axios from 'axios'
import { getAccessToken } from '@/core/auth/AuthContext'
import { ENDPOINTS } from './apiEndpoints'

// ---------------------------------------------------------------------------
// Configuração base
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const DEFAULT_TIMEOUT = 15_000 // 15 segundos

// ---------------------------------------------------------------------------
// AppError — shape padronizado de erro para toda a aplicação
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AppErrorShape
 * @property {string}       message        - Mensagem legível para o usuário ou desenvolvedor
 * @property {number|null}  status         - HTTP status code (ex: 400, 401, 404, 500); null em erros de rede
 * @property {string|null}  code           - Código de negócio devolvido pelo backend (ex: 'TEMPLATE_NOT_FOUND')
 * @property {any}          details        - Payload extra de validação ou contexto do erro (ex: array de field errors)
 * @property {boolean}      isNetworkError - true quando não houve resposta do servidor (timeout, offline, CORS)
 * @property {boolean}      isAuthError    - true quando status === 401 ou 403
 */

/**
 * Erro padronizado da aplicação HERMES.
 * Todos os erros que saem do `apiClient` são instâncias desta classe.
 *
 * @class AppError
 * @extends {Error}
 *
 * @example
 * try {
 *   await apiClient.post('/notifications', payload)
 * } catch (err) {
 *   if (err instanceof AppError && err.isAuthError) {
 *     // redirecionar para login
 *   }
 *   console.error(err.message, err.details)
 * }
 */
export class AppError extends Error {
  /**
   * @param {AppErrorShape} options
   */
  constructor({ message, status = null, code = null, details = null, isNetworkError = false, isAuthError = false }) {
    super(message)
    this.name = 'AppError'
    /** @type {number|null} */
    this.status = status
    /** @type {string|null} */
    this.code = code
    /** @type {any} */
    this.details = details
    /** @type {boolean} */
    this.isNetworkError = isNetworkError
    /** @type {boolean} */
    this.isAuthError = isAuthError

    // Mantém stack trace correto em ambientes que suportam
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

// ---------------------------------------------------------------------------
// Estado interno do mecanismo de refresh
// ---------------------------------------------------------------------------

/**
 * Indica se um refresh de token está em progresso.
 * Impede múltiplos refreshes paralelos quando várias requisições recebem 401 simultaneamente.
 * @type {boolean}
 */
let isRefreshing = false

/**
 * Fila de resolvers/rejecters de requisições represadas durante o refresh.
 * Cada item é { resolve, reject } associado à Promise que bloqueia a requisição original.
 * @type {Array<{ resolve: Function, reject: Function }>}
 */
let pendingQueue = []

/**
 * Callback de logout registrado externamente (pelo AuthProvider).
 * Invocado quando o refresh falha, para deslogar o usuário e limpar o estado de autenticação.
 * @type {Function|null}
 */
let logoutCallback = null

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Resolve todas as requisições na fila com o novo token, ou as rejeita em caso de falha.
 *
 * @param {string|null} token - Novo access token obtido no refresh; null em caso de falha
 * @param {AppError|null} error - Erro a propagar para a fila em caso de falha no refresh
 * @returns {void}
 */
const flushQueue = (token, error = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })
  pendingQueue = []
}

/**
 * Enfileira uma requisição para ser reprocessada após o refresh do token.
 * Retorna uma Promise que será resolvida (com o novo token) ou rejeitada quando o refresh terminar.
 *
 * @returns {Promise<string>} - Resolve com o novo access token
 */
const enqueueRequest = () =>
  new Promise((resolve, reject) => {
    pendingQueue.push({ resolve, reject })
  })

/**
 * Constrói um `AppError` a partir de um erro bruto do Axios.
 *
 * @param {import('axios').AxiosError} axiosError
 * @returns {AppError}
 */
const buildAppError = (axiosError) => {
  // Erro de rede: sem resposta do servidor
  if (!axiosError.response) {
    return new AppError({
      message: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
      status: null,
      code: 'NETWORK_ERROR',
      details: null,
      isNetworkError: true,
      isAuthError: false,
    })
  }

  const { status, data } = axiosError.response

  // Tenta extrair campos padronizados do payload de erro do backend
  const message =
    data?.message ??
    data?.error ??
    axiosError.message ??
    'Ocorreu um erro inesperado.'

  const code = data?.code ?? data?.errorCode ?? null
  const details = data?.details ?? data?.errors ?? null
  const isAuthError = status === 401 || status === 403

  return new AppError({ message, status, code, details, isNetworkError: false, isAuthError })
}

/**
 * Verifica se uma URL é uma rota pública de autenticação (login ou refresh).
 * Usado para evitar loop infinito de refresh em chamadas às próprias rotas de auth.
 *
 * @param {string} url - URL da requisição
 * @returns {boolean}
 */
const isAuthRoute = (url = '') =>
  url.includes(ENDPOINTS.AUTH.LOGIN) || url.includes(ENDPOINTS.AUTH.REFRESH)

// ---------------------------------------------------------------------------
// Criação da instância Axios
// ---------------------------------------------------------------------------

/**
 * Instância configurada do Axios para o HERMES.
 * Use esta instância em todos os services — nunca importe `axios` diretamente.
 *
 * @type {import('axios').AxiosInstance}
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ---------------------------------------------------------------------------
// Interceptor de REQUEST — injeção de token Bearer
// ---------------------------------------------------------------------------

/**
 * Antes de cada requisição, lê o token atual via `getAccessToken()` e o injeta no
 * header `Authorization`. Desta forma, nenhum service precisa gerenciar o token.
 *
 * Se `getAccessToken()` retornar null/undefined (usuário não autenticado),
 * a requisição segue sem o header, e o backend decidirá se exige autenticação.
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(buildAppError(error))
)

// ---------------------------------------------------------------------------
// Interceptor de RESPONSE — normalização de sucesso e tratamento de erro
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  /**
   * Interceptor de sucesso: extrai `response.data` automaticamente.
   * Os services recebem os dados diretamente, sem precisar acessar `.data`.
   *
   * @param {import('axios').AxiosResponse} response
   * @returns {any} - O payload da resposta (`response.data`)
   */
  (response) => response.data,

  /**
   * Interceptor de erro: gerencia 401 com refresh automático e transforma
   * todos os outros erros em `AppError`.
   *
   * Fluxo de 401:
   * 1. Se for rota de auth → rejeita imediatamente (sem tentar refresh)
   * 2. Se já foi marcada como "_retry" → o refresh também falhou → logout
   * 3. Se refresh em andamento → enfileira e aguarda
   * 4. Caso contrário → inicia refresh, desbloqueia fila ao terminar
   *
   * @param {import('axios').AxiosError} error
   * @returns {Promise<any>}
   */
  async (error) => {
    const originalRequest = error.config

    const is401 = error.response?.status === 401

    // Não tentar refresh em rotas de autenticação ou em requisições já retentadas
    if (!is401 || isAuthRoute(originalRequest?.url) || originalRequest?._retry) {
      return Promise.reject(buildAppError(error))
    }

    // Se o refresh já está rodando, enfileira a requisição atual
    if (isRefreshing) {
      return enqueueRequest().then((newToken) => {
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        return apiClient(originalRequest)
      })
    }

    // Marca como "tentando refresh" e sinaliza que um refresh está em andamento
    originalRequest._retry = true
    isRefreshing = true

    try {
      // Chama o endpoint de refresh diretamente via axios puro para não passar pelo interceptor de response
      // (evita loop e garante que recebemos a resposta bruta com o novo token)
      const refreshResponse = await axios.post(
        `${BASE_URL}${ENDPOINTS.AUTH.REFRESH}`,
        {},
        { withCredentials: true } // refresh token tipicamente em cookie HttpOnly
      )

      const newToken = refreshResponse.data?.accessToken ?? refreshResponse.data?.token

      if (!newToken) {
        throw new Error('Refresh não retornou token válido.')
      }

      // Libera a fila com o novo token
      flushQueue(newToken)

      // Retenta a requisição original com o novo token
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      // Refresh falhou → rejeita todas as requisições enfileiradas
      const appErr = buildAppError(refreshError)
      flushQueue(null, appErr)

      // Dispara o logout registrado pelo AuthProvider
      logoutCallback?.()

      return Promise.reject(appErr)
    } finally {
      isRefreshing = false
    }
  }
)

// ---------------------------------------------------------------------------
// API pública do módulo
// ---------------------------------------------------------------------------

/**
 * Registra o callback de logout a ser invocado quando o refresh de token falhar.
 * Deve ser chamado pelo `AuthProvider` na inicialização, antes de qualquer requisição autenticada.
 *
 * Padrão "callback registration" resolve a dependência circular entre o AuthContext
 * (que precisa do apiClient) e o apiClient (que precisa acionar o logout).
 *
 * @param {() => void} callback - Função de logout do AuthProvider
 * @returns {void}
 *
 * @example
 * // Em AuthProvider.jsx:
 * import { onLogout } from '@/core/api/apiClient'
 *
 * useEffect(() => {
 *   onLogout(() => {
 *     dispatch({ type: 'LOGOUT' })
 *     navigate('/login')
 *   })
 * }, [])
 */
export const onLogout = (callback) => {
  logoutCallback = callback
}

export default apiClient