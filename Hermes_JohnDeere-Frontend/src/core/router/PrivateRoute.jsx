/**
 * @file PrivateRoute.jsx
 * @module core/router
 * @description Componente de guarda de rotas do sistema HERMES.
 *
 * Responsabilidades EXCLUSIVAS deste componente:
 *  1. Aguardar a verificação inicial de sessão (`isLoading`) sem redirecionar prematuramente.
 *  2. Redirecionar usuários não-autenticados para `/login`, preservando a rota de origem.
 *  3. Redirecionar usuários autenticados sem o role necessário para `/`, sinalizando não-autorização.
 *  4. Renderizar `<Outlet />` quando todas as verificações passam.
 *
 * Este componente é AGNÓSTICO à composição de layout — ele apenas decide
 * se o usuário pode ou não acessar o que está abaixo dele na árvore de rotas.
 * A aplicação de layout (MainLayout, etc.) é feita em `AppRouter.jsx`.
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import LoadingSpinner from '../../views/components/common/LoadingSpinner.jsx';

// ---------------------------------------------------------------------------
// Constantes internas
// ---------------------------------------------------------------------------

/** Rota de fallback para usuários não-autenticados. */
const LOGIN_PATH = '/login';

/** Rota de fallback para usuários sem permissão de role. */
const HOME_PATH = '/';

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Guarda de rota privada do HERMES.
 *
 * Deve ser usado como elemento de rota pai (layout route) no `createBrowserRouter`.
 * Filhos são renderizados via `<Outlet />` apenas quando todas as verificações passam.
 *
 * @component
 *
 * @param {object}  props
 * @param {string}  [props.requiredRole]  Role mínimo exigido para acessar as rotas filhas.
 *                                        Valores aceitos: `'ADMIN'` | `'USER'` | `undefined`.
 *                                        Quando omitido, qualquer usuário autenticado tem acesso.
 *
 * @example
 * // Rota privada sem restrição de role (qualquer usuário logado):
 * {
 *   element: <PrivateRoute />,
 *   children: [{ path: '/', element: <DashboardPage /> }],
 * }
 *
 * @example
 * // Rota privada restrita a administradores:
 * {
 *   element: <PrivateRoute requiredRole="ADMIN" />,
 *   children: [{ path: '/templates/new', element: <TemplateFormPage /> }],
 * }
 *
 * @returns {React.ReactElement}
 *   - `<LoadingSpinner />` fullscreen enquanto a sessão está sendo verificada.
 *   - `<Navigate to="/login" />` se não autenticado (preserva `state.from`).
 *   - `<Navigate to="/" />`     se sem o role necessário (sinaliza `state.unauthorized`).
 *   - `<Outlet />`              se autenticado e autorizado.
 */
function PrivateRoute({ requiredRole }) {
  const { isAuthenticated, isLoading, isAdmin, user } = useAuth();
  const location = useLocation();

  // -------------------------------------------------------------------------
  // CASO 1 — Verificação de sessão em andamento
  // Nunca redirecionar durante o carregamento: isso causaria flash de tela e
  // redirecionamentos incorretos quando o token ainda está sendo validado.
  // -------------------------------------------------------------------------
  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  // -------------------------------------------------------------------------
  // CASO 2 — Usuário não autenticado
  // Preservamos `location` em `state.from` para que o LoginPage possa
  // redirecionar de volta à rota original após um login bem-sucedido.
  // -------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <Navigate
        to={LOGIN_PATH}
        state={{ from: location }}
        replace
      />
    );
  }

  // -------------------------------------------------------------------------
  // CASO 3 — Usuário autenticado mas sem o role necessário
  // Redirecionamos para `/` e sinalizamos `state.unauthorized = true` para
  // que o componente de destino (DashboardPage ou equivalente) possa exibir
  // um feedback contextual sem acoplar lógica de autorização à view.
  //
  // Verificação de role:
  //   - Se `requiredRole === 'ADMIN'`, usamos o atalho `isAdmin` do useAuth.
  //   - Para outros roles futuros, comparamos `user.role` diretamente,
  //     tornando o sistema extensível sem modificar este componente.
  // -------------------------------------------------------------------------
  if (requiredRole) {
    const hasRequiredRole =
      requiredRole === 'ADMIN'
        ? isAdmin
        : user?.role === requiredRole;

    if (!hasRequiredRole) {
      return (
        <Navigate
          to={HOME_PATH}
          state={{ unauthorized: true, requiredRole, from: location }}
          replace
        />
      );
    }
  }

  // -------------------------------------------------------------------------
  // CASO 4 — Autenticado e autorizado
  // Renderiza os filhos da rota via Outlet (padrão React Router v6).
  // -------------------------------------------------------------------------
  return <Outlet />;
}

export default PrivateRoute;