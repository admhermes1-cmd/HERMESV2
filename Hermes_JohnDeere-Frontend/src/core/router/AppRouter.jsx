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
 *  │   └─ MainLayout              ← layout autenticado (sidebar + header)
 *  │       ├─ /                   (DashboardPage)
 *  │       ├─ /templates          (TemplatesPage)
 *  │       └─ /notifications/new  (NotificationFormPage)
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
import UsersPage    from '../../views/pages/UsersPage';
import UserFormPage from '../../views/pages/UserFormPage';

// ---------------------------------------------------------------------------
// Importações lazy das páginas
// Cada página vira um chunk separado — carregado apenas quando acessada.
// O comentário /* webpackChunkName */ é preservado pelo Vite (via Rollup)
// e produz nomes legíveis nos bundles de produção.
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
 * O componente detecta internamente o modo via useParams().
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
 * Enquanto a sessão está sendo verificada (isLoading), exibe o spinner
 * para evitar flash de redirect incorreto.
 *
 * @component
 * @returns {React.ReactElement}
 *   - <LoadingSpinner /> enquanto verifica a sessão.
 *   - <Navigate to="/" /> (ou state.from) se já autenticado.
 *   - <Outlet />          se não autenticado.
 */
function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  if (isAuthenticated) {
    // Redireciona de volta para onde o usuário queria ir (se veio de uma rota
    // protegida que o mandou ao login) ou para o dashboard como padrão.
    const destination = location.state?.from?.pathname ?? '/';
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

// ---------------------------------------------------------------------------
// Definição do router (singleton fora do componente)
// ---------------------------------------------------------------------------

/**
 * Instância singleton do router do HERMES.
 *
 * Criada fora do componente `AppRouter` intencionalmente: recriar o router
 * a cada render causaria re-montagem completa da árvore de rotas, perdendo
 * estado de formulários, scroll position e histórico de navegação.
 *
 * @see https://reactrouter.com/en/main/routers/create-browser-router
 */
const router = createBrowserRouter([

  // =========================================================================
  // BLOCO 1 — Rotas públicas com AuthLayout
  // =========================================================================
  {
    /**
     * Wrapper de layout para telas de autenticação.
     * AuthLayout fornece o visual de tela cheia de login (logo, fundo, etc.).
     */
    element: <AuthLayout />,
    children: [
      {
        /**
         * Guarda de rota pública: redireciona usuários já logados.
         * Mantido como rota aninhada separada para preservar a responsabilidade
         * única do AuthLayout (apenas fornecer o shell visual).
         */
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
  // BLOCO 2 — Rotas privadas (qualquer usuário autenticado) com MainLayout
  // =========================================================================
  {
    /**
     * Guarda de autenticação sem restrição de role.
     * Qualquer usuário autenticado tem acesso às rotas filhas.
     */
    element: <PrivateRoute />,
    children: [
      {
        /**
         * Shell autenticado: sidebar, header, e área de conteúdo principal.
         * Todas as páginas internas compartilham este layout via Outlet.
         */
        element: <MainLayout />,
        children: [
          {
            /** Redireciona raiz para o dashboard. */
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/',
            element: <Navigate to="/dashboard" replace />,
          },
          {
            /** Dashboard — rota raiz da área autenticada. */
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            /** Listagem de todos os templates de notificação. */
            path: '/templates',
            element: <TemplatesPage />,
          },
          {
            /** Formulário de criação/agendamento de nova notificação. */
            path: '/notifications/new',
            element: <NotificationFormPage />,
          },
          {
          path:    APP_CONSTANTS.ROUTES.USERS,      // '/users'
          element: <UsersPage />,
          },
          {
          path:    APP_CONSTANTS.ROUTES.USER_NEW,   // '/users/new'
          element: <UserFormPage />,
          },
          {
          path:    '/users/:id/edit',
          element: <UserFormPage />,
          },
        ],
      },
    ],
  },

  // =========================================================================
  // BLOCO 3 — Rotas privadas ADMIN-only com MainLayout
  // =========================================================================
  {
    /**
     * Guarda de autenticação com role ADMIN obrigatório.
     * Usuários autenticados sem role ADMIN são redirecionados para /
     * com state.unauthorized = true — acessível via useLocation na view.
     */
    element: <PrivateRoute requiredRole="ADMIN" />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            /**
             * Criação de novo template.
             * Separado de /templates para que a listagem permaneça acessível
             * a todos os usuários, enquanto apenas admins criam templates.
             */
            path: '/templates/new',
            element: <TemplateFormPage />,
          },
          {
            /**
             * Edição de template existente.
             * O parâmetro dinâmico :id é extraído internamente pelo
             * TemplateFormPage via useParams() para buscar os dados do template.
             */
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
    /**
     * Rota curinga: captura qualquer path não mapeado acima.
     * Renderizada standalone, sem layout, sem guarda de autenticação.
     * A NotFoundPage é responsável pelo seu próprio visual e link de volta.
     */
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
 * Deve ser montado no App.jsx como filho direto do AuthProvider.
 * O Suspense envolve o RouterProvider para capturar as promises de
 * carregamento lazy das páginas — sem ele, o React lançaria um erro de
 * Suspense sem boundary definido.
 *
 * @component
 *
 * @example
 * // App.jsx
 * import { AuthProvider } from './core/auth/AuthContext';
 * import AppRouter from './core/router/AppRouter';
 *
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <AppRouter />
 *     </AuthProvider>
 *   );
 * }
 *
 * @returns {React.ReactElement} O provider de rotas completo da aplicação.
 */
function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner fullscreen />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default AppRouter;
