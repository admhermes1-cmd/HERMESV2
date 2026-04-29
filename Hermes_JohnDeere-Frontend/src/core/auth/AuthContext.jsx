/**
 * @fileoverview AuthContext — Camada central de autenticação do HERMES.
 *
 * DECISÃO DE ARMAZENAMENTO DO TOKEN
 * ──────────────────────────────────────────────────────────────────────────────
 * Access Token  → mantido APENAS em memória (variável de módulo `_accessToken`).
 *   Motivo: tokens em localStorage são vulneráveis a ataques XSS. Manter em
 *   memória limita o vetor de ataque: um script malicioso injetado não consegue
 *   ler a variável de closure de outro módulo ES.
 *
 * Refresh Token → tratado como httpOnly cookie gerenciado pelo servidor.
 *   O frontend NUNCA lê nem armazena o refreshToken diretamente. Ao chamar
 *   `authService.refreshToken()`, o browser envia o cookie automaticamente e
 *   o servidor retorna um novo access token (+ renova o cookie httpOnly).
 *
 * Limitação conhecida: em ambientes de desenvolvimento sem CORS/cookie correto
 *   (ex.: Vite dev server sem proxy configurado), o cookie httpOnly pode não
 *   ser enviado. Nesses casos, configure `proxy` no vite.config.js ou use um
 *   mock de authService que simule o comportamento.
 *
 * Acessibilidade para apiClient.js
 *   O access token é exposto via getter `getAccessToken()` exportado abaixo.
 *   O apiClient deve importar essa função e injetá-la no header Authorization
 *   a cada requisição (interceptor de request do axios ou fetch wrapper).
 *   Exemplo:
 *     import { getAccessToken } from '@/core/auth/AuthContext';
 *     headers['Authorization'] = `Bearer ${getAccessToken()}`;
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * @module core/auth/AuthContext
 */

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { authService } from '@/services/authService';
import { createUser } from '@/models/User';

// ─── Token em memória (fora do React state para não causar re-renders extras) ───
/** @type {string | null} */
let _accessToken = null;

/**
 * Retorna o access token atual mantido em memória.
 * Use esta função no interceptor do apiClient para injetar o header Authorization.
 *
 * @returns {string | null} O JWT de acesso atual, ou null se não autenticado.
 */
export const getAccessToken = () => _accessToken;

// ─── Margem de segurança para o refresh (ms antes da expiração real) ───────────
const REFRESH_MARGIN_MS = 60_000; // 1 minuto antes de expirar

// ─── Contexto ────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} AuthContextShape
 * @property {import('@/models/User').User | null} user        - Usuário autenticado ou null.
 * @property {string | null}                       token       - Access token JWT em memória (leitura via getAccessToken()).
 * @property {boolean}                             isAuthenticated - true se há usuário e token válidos.
 * @property {boolean}                             isLoading   - true durante a verificação inicial de sessão (evita flash de login).
 * @property {string | null}                       error       - Mensagem do último erro de autenticação, ou null.
 * @property {(email: string, password: string) => Promise<void>} login - Realiza o login.
 * @property {() => Promise<void>}                 logout      - Realiza o logout e limpa todo estado.
 * @property {() => void}                          clearError  - Limpa o estado de erro.
 */

/**
 * Contexto de autenticação.
 * NÃO consuma diretamente nos componentes — use o hook `useAuth` em vez disso.
 *
 * @type {React.Context<AuthContextShape | undefined>}
 */
export const AuthContext = createContext(undefined);

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Decodifica o payload de um JWT e retorna o timestamp de expiração em ms.
 * Não valida a assinatura — apenas lê o campo `exp` do payload Base64.
 *
 * @param {string} token - JWT no formato header.payload.signature.
 * @returns {number | null} Timestamp de expiração em milissegundos, ou null se inválido.
 */
function decodeTokenExpiry(token) {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;

    // Base64url → Base64 padrão → decode
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(normalized);
    const payload = JSON.parse(jsonStr);

    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Calcula quantos ms faltam para o refresh, respeitando a margem de segurança.
 * Retorna null quando o token já está expirado ou próximo demais para agendar.
 *
 * @param {string} token - JWT atual.
 * @returns {number | null} Delay em ms para o próximo refresh, ou null.
 */
function calcRefreshDelay(token) {
  const expiryMs = decodeTokenExpiry(token);
  if (!expiryMs) return null;

  const delay = expiryMs - Date.now() - REFRESH_MARGIN_MS;
  return delay > 0 ? delay : null;
}

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Provider de autenticação do HERMES.
 * Deve envolver a aplicação inteira (normalmente em App.jsx ou main.jsx),
 * acima do Router, para que PrivateRoute e todos os componentes tenham acesso.
 *
 * @param {Object}           props
 * @param {React.ReactNode}  props.children - Árvore de componentes filhos.
 * @returns {JSX.Element}
 *
 * @example
 * // App.jsx
 * import { AuthProvider } from '@/core/auth/AuthContext';
 *
 * export default function App() {
 *   return (
 *     <AuthProvider>
 *       <AppRouter />
 *     </AuthProvider>
 *   );
 * }
 */
export function AuthProvider({ children }) {
  /** @type {[import('@/models/User').User | null, Function]} */
  const [user, setUser] = useState(null);

  /**
   * Espelho do token em state — usado apenas para disparar re-renders quando
   * o token muda. O valor real lido pelo apiClient vem de `_accessToken`.
   * @type {[string | null, Function]}
   */
  const [token, setToken] = useState(null);

  /** true durante a verificação inicial de sessão ao montar o provider */
  const [isLoading, setIsLoading] = useState(true);

  /** Mensagem do último erro de autenticação */
  const [error, setError] = useState(null);

  /** Ref para o timer de refresh automático — permite cancelamento */
  const refreshTimerRef = useRef(null);

  // ─── Helpers de estado ───────────────────────────────────────────────────

  /**
   * Armazena o token em memória + estado e agenda o próximo refresh.
   * @param {string} newToken
   */
  const _storeToken = useCallback((newToken) => {
    _accessToken = newToken;
    setToken(newToken);
  }, []);

  /**
   * Limpa token, usuário e cancela qualquer refresh agendado.
   */
  const _clearSession = useCallback(() => {
    _accessToken = null;
    setToken(null);
    setUser(null);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ─── Refresh automático ──────────────────────────────────────────────────

  /**
   * Agenda o próximo refresh de token com base na expiração do JWT atual.
   * Cancela qualquer timer anterior antes de agendar um novo.
   *
   * @param {string} currentToken - JWT atual para calcular o tempo restante.
   */
  const _scheduleRefresh = useCallback((currentToken) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const delay = calcRefreshDelay(currentToken);
    if (!delay) {
      // Token já expirado ou sem campo exp — força logout silencioso
      _clearSession();
      return;
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        // O refreshToken httpOnly é enviado automaticamente pelo browser
        const { token: newToken } = await authService.refreshToken();
        _storeToken(newToken);
        _scheduleRefresh(newToken);
      } catch {
        // Refresh falhou (cookie expirado, sessão invalidada no backend, etc.)
        _clearSession();
      }
    }, delay);
  }, [_clearSession, _storeToken]);

  // ─── Inicialização: verificar sessão existente ao montar ─────────────────

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        // Tenta obter um novo access token usando o refreshToken (httpOnly cookie).
        // Se o cookie não existir ou estiver expirado, authService lança erro.
        const { token: newToken } = await authService.refreshToken();

        if (cancelled) return;

        // Token válido — busca dados do usuário
        _storeToken(newToken);
        const userData = await authService.getMe();

        if (cancelled) return;

        setUser(createUser(userData));
        _scheduleRefresh(newToken);
      } catch {
        // Sem sessão ativa — estado inicial não autenticado (sem erro exposto)
        if (!cancelled) _clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Intencionalmente vazio: roda apenas na montagem inicial.

  // ─── Ações públicas ──────────────────────────────────────────────────────

  /**
   * Realiza o login com e-mail e senha.
   * Em caso de sucesso, popula usuário e token no contexto.
   * Em caso de falha, armazena a mensagem de erro em `error`.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const { user: userData, token: newToken } = await authService.login({ email, password });
      _storeToken(newToken);
      setUser(createUser(userData));
      _scheduleRefresh(newToken);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Falha ao realizar login. Verifique suas credenciais.';
      setError(message);
      // Re-throw so callers (e.g. useLoginViewModel) can handle the error themselves
      throw err;
    }
  }, [_storeToken, _scheduleRefresh]);

  /**
   * Realiza o logout: invalida a sessão no backend, limpa estado local e
   * cancela o refresh agendado. Erros de rede no logout são silenciados
   * (sessão local é sempre limpa independentemente).
   *
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Falha no backend não impede limpeza do estado local
    } finally {
      _clearSession();
      setError(null);
    }
  }, [_clearSession]);

  /**
   * Limpa a mensagem de erro atual.
   * Útil para resetar o estado após o usuário dispensar uma notificação de erro.
   *
   * @returns {void}
   */
  const clearError = useCallback(() => setError(null), []);

  // ─── Valor do contexto ────────────────────────────────────────────────────

  /** @type {AuthContextShape} */
  const contextValue = {
    user,
    token,           // espelho em state — use getAccessToken() no apiClient
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
