/**
 * @file AppRouter.jsx
 * @module core/router
 * @description Composição central de rotas do sistema HERMES.
 *
 * Responsabilidades EXCLUSIVAS deste componente:
 *  1. Definir TODAS as rotas da aplicação via `createBrowserRouter`.
 *  2. Aplicar os layouts corretos (MainLayout, AuthLayout) via nested routes.
 *  3. Delegar a guarda de acesso ao `PrivateRoute`.
 *  4. Importar todas as páginas com `React.lazy` para code splitting automático.
 *  5. Envolver o `RouterProvider` com `<Suspense>` para loading durante chunks.
 *
 * Estratégia de nested routes:
 *  ┌─ AuthLayout
 *  │   └─ PublicOnlyRoute → /login
 *  │
 *  ├─ PrivateRoute (qualquer autenticado)
 *  │   ├─ /change-password            (sem MainLayout)
 *  │   └─ MainLayout
 *  │       ├─ /dashboard
 *  │       ├─ /templates
 *  │       ├─ /notifications/new
 *  │       ├─ /notifications/bulk
 *  │       ├─ /users                  (UsersPage)
 *  │       ├─ /users/new              (UserFormPage)
 *  │       └─ /users/:id/edit         (UserFormPage)
 *  │
 *  ├─ PrivateRoute[ADMIN]
 *  │   └─ MainLayout
 *  │       ├─ /templates/new
 *  │       └─ /templates/:id/edit
 *  │
 *  ├─ PrivateRoute[ADMIN,GESTOR]
 *  │   └─ MainLayout
 *  │       ├─ /celulas
 *  │       ├─ /celulas/new            (apenas ADMIN — validado no backend)
 *  │       └─ /celulas/:id/edit
 *  │
 *  └─ * → NotFoundPage
 */

import React, { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';

import { useAuth }         from '../auth/useAuth';
import PrivateRoute        from './PrivateRoute.jsx';
import LoadingSpinner      from '../../views/components/common/LoadingSpinner.jsx';
import MainLayout          from '../../views/layouts/MainLayout.jsx';
import AuthLayout          from '../../views/layouts/AuthLayout.jsx';
import UsersPage           from '../../views/pages/UsersPage';
import UserFormPage        from '../../views/pages/UserFormPage';
import ChangePasswordPage  from '../../views/pages/ChangePasswordPage';
import CelulasPage         from '../../views/pages/CelulasPage';
import CelulaFormPage      from '../../views/pages/CelulaFormPage';
import BulkNotificationPage from '../../views/pages/BulkNotificationPage';
import { ROUTES }          from '../constants/appConstants';

// ---------------------------------------------------------------------------
// Importações lazy das páginas
// ---------------------------------------------------------------------------

const LoginPage = lazy(() =>
  import(/* webpackChunkName: "page-login" */ '../../views/pages/LoginPage.jsx')
);

const DashboardPage = lazy(() =>
  import(/* webpackChunkName: "page-dashboard" */ '../../views/pages/DashboardPage.jsx')
);

const TemplatesPage = lazy(() =>
  import(/* webpackChunkName: "page-templates" */ '../../views/pages/TemplatesPage.jsx')
);

const TemplateFormPage = lazy(() =>
  import(/* webpackChunkName: "page-template-form" */ '../../views/pages/TemplateFormPage.jsx')
);

const NotificationFormPage = lazy(() =>
  import(/* webpackChunkName: "page-notification-form" */ '../../views/pages/NotificationFormPage.jsx')
);

const NotFoundPage = lazy(() =>
  import(/* webpackChunkName: "page-not-found" */ '../../views/pages/NotFoundPage.jsx')
);

// ---------------------------------------------------------------------------
// PublicOnlyRoute
// ---------------------------------------------------------------------------

/**
 * Guarda de rotas "somente para não-autenticados".
 * Se o usuário já estiver autenticado e tentar acessar /login,
 * redireciona para a rota de origem ou para /.
 *
 * @component
 */
function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname ?? '/';
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

// ---------------------------------------------------------------------------
// Definição do router (singleton fora do componente)
// ---------------------------------------------------------------------------

const router = createBrowserRouter([

  // =========================================================================
  // BLOCO 1 — Rotas públicas com AuthLayout
  // =========================================================================
  {
    element: <AuthLayout />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
        ],
      },
    ],
  },

  // =========================================================================
  // BLOCO 2 — Rotas privadas (qualquer usuário autenticado)
  // =========================================================================
  {
    element: <PrivateRoute />,
    children: [

      // /change-password — tela isolada, SEM MainLayout.
      {
        path: '/change-password',
        element: <ChangePasswordPage />,
      },

      // Demais rotas autenticadas — COM MainLayout
      {
        element: <MainLayout />,
        children: [
          { index: true,           element: <Navigate to="/dashboard" replace /> },
          { path: '/',             element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard',    element: <DashboardPage /> },
          { path: '/templates',    element: <TemplatesPage /> },
          { path: '/notifications/new',  element: <NotificationFormPage /> },
          { path: '/notifications/bulk', element: <BulkNotificationPage /> },
          { path: ROUTES.USERS,    element: <UsersPage /> },
          { path: ROUTES.USER_NEW, element: <UserFormPage /> },
          { path: '/users/:id/edit', element: <UserFormPage /> },
        ],
      },
    ],
  },

  // =========================================================================
  // BLOCO 3 — Rotas privadas ADMIN-only
  // =========================================================================
  {
    element: <PrivateRoute requiredRole="ADMIN" />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/templates/new',      element: <TemplateFormPage /> },
          { path: '/templates/:id/edit', element: <TemplateFormPage /> },
        ],
      },
    ],
  },

  // =========================================================================
  // BLOCO 4 — Rotas privadas ADMIN ou GESTOR (Células)
  // =========================================================================
  {
    element: <PrivateRoute requiredRole={['ADMIN', 'GESTOR']} />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: ROUTES.CELULAS,         element: <CelulasPage /> },
          { path: ROUTES.CELULA_NEW,      element: <CelulaFormPage /> },
          { path: '/celulas/:id/edit',    element: <CelulaFormPage /> },
        ],
      },
    ],
  },

  // =========================================================================
  // BLOCO 5 — Catch-all 404
  // =========================================================================
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Ponto de entrada do sistema de roteamento do HERMES.
 *
 * @component
 * @returns {JSX.Element}
 */
function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner fullscreen />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default AppRouter;
