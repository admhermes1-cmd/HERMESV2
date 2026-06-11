/**
 * @file PrivateRoute.jsx
 * @module core/router
 * @description Componente de guarda de rotas do sistema HERMES.
 *
 * Responsabilidades EXCLUSIVAS deste componente:
 *  1. Aguardar a verificação inicial de sessão (`isLoading`) sem redirecionar prematuramente.
 *  2. Redirecionar usuários não-autenticados para `/login`, preservando a rota de origem.
 *  3. Redirecionar usuários com `mustChangePassword = true` para `/change-password`,
 *     impedindo acesso a qualquer outra rota até a troca ser concluída.
 *  4. Redirecionar usuários autenticados sem o role necessário para `/dashboard`,
 *     sinalizando não-autorização.
 *  5. Renderizar `<Outlet />` quando todas as verificações passam.
 *
 * `requiredRole` aceita string ou array de strings:
 *   - `requiredRole="ADMIN"`                → apenas ADMIN
 *   - `requiredRole={['ADMIN', 'GESTOR']}`  → ADMIN ou GESTOR
 *   - omitido                               → qualquer usuário autenticado
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import LoadingSpinner from '../../views/components/common/LoadingSpinner.jsx';

const LOGIN_PATH           = '/login';
const HOME_PATH            = '/dashboard';
const CHANGE_PASSWORD_PATH = '/change-password';

/**
 * Guarda de rota privada do HERMES.
 *
 * @component
 * @param {object}          props
 * @param {string|string[]} [props.requiredRole] Role(s) exigido(s) para acesso.
 * @returns {React.ReactElement}
 */
function PrivateRoute({ requiredRole }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // ── CASO 1: sessão ainda carregando ──────────────────────────────────────
  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  // ── CASO 2: não autenticado ───────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATH} state={{ from: location }} replace />;
  }

  // ── CASO 3: troca de senha obrigatória ────────────────────────────────────
  if (user?.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  // ── CASO 4: verificação de role ───────────────────────────────────────────
  // Normaliza requiredRole para array, suportando string ou string[].
  // Ex: "ADMIN" → ["ADMIN"] | ["ADMIN","GESTOR"] → ["ADMIN","GESTOR"]
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole     = user?.role ?? '';
    const hasRole      = allowedRoles.includes(userRole);

    if (!hasRole) {
      return (
        <Navigate
          to={HOME_PATH}
          state={{ unauthorized: true, requiredRole, from: location }}
          replace
        />
      );
    }
  }

  // ── CASO 5: autenticado e autorizado ─────────────────────────────────────
  return <Outlet />;
}

export default PrivateRoute;
