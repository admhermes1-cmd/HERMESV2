/**
 * @file AppRouter.jsx
 * @module core/router
 * @description Composição central de rotas do sistema HERMES.
 *
 * Responsabilidades EXCLUSIVAS deste componente:
 *  1. Definir TODAS as rotas da aplicação via `createBrowserRouter` (API moderna do React Router v6).
 *  2. Aplicar os layouts corretos (MainLayout, AuthLayout) via nested routes.
 *  3. Delegar a guarda de acesso ao `PrivateRoute` — sem lógica de auth aqui.
 *  4. Importar todas as páginas com `React.lazy` para code splitting automático.
 *  5. Envolver o `RouterProvider` com `<Suspense>` para exibir loading durante
 *     o carregamento assíncrono dos chunks de página.
 *
 * Estratégia de nested routes:
 *  ┌─ AuthLayout                  ← layout de telas públicas
 *  │   └─ PublicOnlyRoute
 *  │       └─ /login
 *  │
 *  ├─ PrivateRoute                ← guarda: qualquer usuário autenticado
 *  │   ├─ /change-password        (ChangePasswordPage — SEM MainLayout, tela isolada)
 *  │   └─ MainLayout              ← layout autenticado (sidebar + header)
 *  │       ├─ /                   (DashboardPage)
 *  │       ├─ /dashboard
 *  │       ├─ /templates          (TemplatesPage)
 *  │       ├─ /notifications/new  (NotificationFormPage)
 *  │       ├─ /users              (UsersPage)
 *  │       ├─ /users/new          (UserFormPage)
 *  │       └─ /users/:id/edit     (UserFormPage)
 *  │
 *  ├─ PrivateRoute[ADMIN]         ← guarda: autenticado + role ADMIN
 *  │   └─ MainLayout
 *  │       ├─ /templates/new      (TemplateFormPage)
 *  │       └─ /templates/:id/edit (TemplateFormPage)
 *  │
 *  └─ *                           ← NotFoundPage (standalone, sem layout)
 */

import React, { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import PrivateRoute from './PrivateRoute.jsx';
import LoadingSpinner from '../../views/components/common/LoadingSpinner.jsx';
import MainLayout from '../../views/layouts/MainLayout.jsx';
import AuthLayout from '../../views/layouts/AuthLayout.jsx';
import UsersPage from '../../views/pages/UsersPage';
import UserFormPage from '../../views/pages/UserFormPage';
import ChangePasswordPage from '../../views/pages/ChangePasswordPage';
import { ROUTES } from '../constants/appConstants';
import BulkNotificationPage from '../views/pages/BulkNotificationPage';

// ---------------------------------------------------------------------------
// Importações lazy das páginas
// ---------------------------------------------------------------------------

/** @type {React.LazyExoticComponent} Página de login. */
const LoginPage = lazy(() =>
  import(/* webpackChunkName: "page-login" */ '../../views/pages/LoginPage.jsx')
);

/** @type {React.LazyExoticComponent} Dashboard principal. */
const DashboardPage = lazy(() =>
  import(/* webpackChunkName: "page-dashboard" */ '../../views/pages/DashboardPage.jsx')
);

/** @type {React.LazyExoticComponent} Listagem de templates. */
const TemplatesPage = lazy(() =>
  import(/* webpackChunkName: "page-templates" */ '../../views/pages/TemplatesPage.jsx')
);

/**
 * @type {React.LazyExoticComponent}
 * Formulário de template — reutilizado em /templates/new e /templates/:id/edit.
 */
const TemplateFormPage = lazy(() =>
  import(/* webpackChunkName: "page-template-form" */ '../../views/pages/TemplateFormPage.jsx')
);

/** @type {React.LazyExoticComponent} Formulário de envio/agendamento de notificação. */
const NotificationFormPage = lazy(() =>
  import(/* webpackChunkName: "page-notification-form" */ '../../views/pages/NotificationFormPage.jsx')
);

/** @type {React.LazyExoticComponent} Página 404 — standalone, sem layout. */
const NotFoundPage = lazy(() =>
  import(/* webpackChunkName: "page-not-found" */ '../../views/pages/NotFoundPage.jsx')
);

// ---------------------------------------------------------------------------
// PublicOnlyRoute
// ---------------------------------------------------------------------------

/**
 * Guarda de rotas "somente para não-autenticados".
 *
 * Se o usuário já estiver autenticado e tentar acessar /login, ele é
 * redirecionado para a rota de origem (state.from) ou para /.
 *
 * @component
 * @returns {React.ReactElement}
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
          {
            path: '/login',
            element: <LoginPage />,
          },
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

      // ---------------------------------------------------------------------
      // /change-password — tela isolada, SEM MainLayout.
      // Exibida obrigatoriamente no primeiro acesso (mustChangePassword = true).
      // Fica aqui fora do MainLayout para não mostrar sidebar/header enquanto
      // o usuário ainda não completou o cadastro da senha.
      // ---------------------------------------------------------------------
      {
        path: '/change-password',
        element: <ChangePasswordPage />,
      },

      // ---------------------------------------------------------------------
      // Demais rotas autenticadas — COM MainLayout (sidebar + header)
      // ---------------------------------------------------------------------
      {
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/',
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/templates',
            element: <TemplatesPage />,
          },
          {
            path: '/notifications/new',
            element: <NotificationFormPage />,
          },
          {
            path: ROUTES.USERS,
            element: <UsersPage />,
          },
          {
            path: ROUTES.USER_NEW,
            element: <UserFormPage />,
          },
          {
            path: '/users/:id/edit',
            element: <UserFormPage />,
          },
          {
          path: '/notifications/bulk',
          element: <BulkNotificationPage />,
          },
        ],
      },
    ],
  },

  // =========================================================================
  // BLOCO 3 — Rotas privadas ADMIN-only com MainLayout
  // =========================================================================
  {
    element: <PrivateRoute requiredRole="ADMIN" />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            path: '/templates/new',
            element: <TemplateFormPage />,
          },
          {
            path: '/templates/:id/edit',
            element: <TemplateFormPage />,
          },
        ],
      },
    ],
  },

  // =========================================================================
  // BLOCO 4 — Catch-all 404
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
 * @returns {React.ReactElement}
 */
function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner fullscreen />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default AppRouter;
