/**
 * @fileoverview useAuth — Interface pública de autenticação do HERMES.
 *
 * Este hook é o ÚNICO ponto de consumo do AuthContext.
 * Componentes e ViewModels nunca devem importar AuthContext diretamente.
 *
 * @module core/auth/useAuth
 *
 * @example
 * // Em qualquer componente ou ViewModel dentro de <AuthProvider>:
 * import { useAuth } from '@/core/auth/useAuth';
 *
 * function Dashboard() {
 *   const { user, isAuthenticated, isAdmin, logout } = useAuth();
 *
 *   if (!isAuthenticated) return null;
 *
 *   return (
 *     <div>
 *       <p>Olá, {user.name}{isAdmin ? ' (Admin)' : ''}</p>
 *       <button onClick={logout}>Sair</button>
 *     </div>
 *   );
 * }
 */

import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import { UserRole } from '@/models/User';

// ─── Tipos (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {import('./AuthContext').AuthContextShape} AuthContextShape
 */

/**
 * @typedef {Object} UseAuthReturn
 * @property {import('@/models/User').User | null} user
 *   Objeto do usuário autenticado, ou null quando não autenticado.
 *
 * @property {string | null} token
 *   Espelho em state do access token JWT (para re-renders reativos).
 *   Para leitura direta no apiClient, prefira `getAccessToken()` de AuthContext.
 *
 * @property {boolean} isAuthenticated
 *   Atalho que indica se há usuário e token válidos no contexto.
 *
 * @property {boolean} isLoading
 *   true enquanto a verificação de sessão inicial ainda não concluiu.
 *   Use para exibir um splash/loader global e evitar o flash de tela de login.
 *
 * @property {boolean} isAdmin
 *   Getter computado. true se o usuário autenticado possui role ADMIN.
 *   Retorna false quando não há usuário ou quando a role é USER.
 *
 * @property {string | null} error
 *   Mensagem do último erro de autenticação (ex.: credenciais inválidas).
 *   null quando não há erro pendente.
 *
 * @property {(email: string, password: string) => Promise<void>} login
 *   Dispara o fluxo de autenticação com e-mail e senha.
 *   Em caso de falha, popula `error` — nunca lança para o chamador.
 *
 * @property {() => Promise<void>} logout
 *   Invalida a sessão no backend e limpa todo o estado local de autenticação.
 *
 * @property {() => void} clearError
 *   Reseta o campo `error` para null.
 *   Útil ao fechar toasts/alertas de erro de login.
 * 
 * @property {(partialData: Partial<import('@/models/User').User>) => void} updateUser
 */

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook de autenticação do HERMES.
 *
 * Fornece todo o estado e as ações de autenticação da aplicação.
 * Deve ser utilizado exclusivamente dentro da árvore coberta por `<AuthProvider>`.
 *
 * @returns {UseAuthReturn} Objeto com estado e ações de autenticação.
 *
 * @throws {Error} Se chamado fora de um `<AuthProvider>` — falha ruidosa e intencional
 *   para facilitar a detecção de erros de configuração durante o desenvolvimento.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error(
      '[HERMES] useAuth deve ser usado dentro de <AuthProvider>.\n' +
      'Verifique se AuthProvider envolve o componente que está tentando chamar useAuth().\n' +
      'Consulte src/core/auth/AuthContext.jsx para a configuração correta.',
    );
  }

  /**
   * Getter computado: true se o usuário autenticado é administrador do sistema.
   * Baseado em `UserRole.ADMIN` definido em src/models/User.js.
   *
   * @type {boolean}
   */
  const isAdmin = context.user?.role === UserRole.ADMIN;

  return {
    // ── Estado ──────────────────────────────────────────────────────────────
    user:            context.user,
    token:           context.token,
    isAuthenticated: context.isAuthenticated,
    isLoading:       context.isLoading,
    error:           context.error,

    // ── Getter computado ────────────────────────────────────────────────────
    isAdmin,

    // ── Ações ───────────────────────────────────────────────────────────────
    login:      context.login,
    logout:     context.logout,
    clearError: context.clearError,
    updateUser: context.updateUser,
  };
}