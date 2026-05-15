import { useEffect } from 'react';

import { AuthProvider, AuthContext } from '@/core/auth/AuthContext';
import { onLogout } from '@/core/api/apiClient';
import AppRouter from '@/core/router/AppRouter';

// ─── LogoutBridge ────────────────────────────────────────────────────────────

/**
 * LogoutBridge — componente interno sem renderização visual.
 *
 * **Problema que resolve:** o `apiClient` (Axios) precisa chamar `logout()`
 * quando recebe um 401 irrecuperável (token expirado, revogado, etc.), mas
 * ele é instanciado fora da árvore React — logo, não tem acesso direto ao
 * contexto de autenticação.
 *
 * **Solução:** este componente consome o `AuthContext` de dentro da árvore e
 * registra a função `logout` no `apiClient` via `onLogout(callback)` assim
 * que o `AuthProvider` monta. A partir desse momento, o interceptor do
 * Axios pode disparar o logout sem criar dependência circular entre módulos.
 *
 * **Por que aqui e não no App?** O `AuthContext` só está disponível como
 * descendente do `AuthProvider`. Ao isolar a lógica num componente-filho,
 * mantemos o `App` limpo (apenas composição de providers) e o `LogoutBridge`
 * com responsabilidade única e testável.
 *
 * **Ciclo de vida:** o `useEffect` é executado uma única vez após a montagem
 * (deps `[]`). O `onLogout` registra o callback de forma síncrona — sem
 * side-effects assíncronos — portanto não há cleanup necessário.
 *
 * @param {object}   props
 * @param {Function} props.logout - Função `logout` obtida pelo AuthContext pai.
 * @returns {null} Não renderiza nenhum nó no DOM.
 */
function LogoutBridge({ logout }) {
  useEffect(() => {
    /**
     * Registra o callback de logout no apiClient.
     * A partir deste momento, o interceptor de resposta do Axios consegue
     * chamar `logout()` ao detectar um 401 sem depender da árvore React.
     */
    onLogout(logout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // `logout` vem do AuthContext e é estável (criada com useCallback lá dentro).
  // Incluí-la nas deps causaria re-registros desnecessários; o eslint-disable
  // documenta a decisão intencional.

  return null;
}

// ─── App ─────────────────────────────────────────────────────────────────────

/**
 * App — componente raiz da aplicação HERMES.
 *
 * **Responsabilidade exclusiva:** composição de providers e wiring de
 * infraestrutura. Nenhuma lógica de negócio, estado de UI ou chamada de API
 * deve residir aqui.
 *
 * **Ordem dos providers (de fora para dentro):**
 * ```
 * <AuthProvider>          → contexto global de autenticação (token, user, login, logout)
 *   <LogoutBridge />      → registra logout no apiClient (sem DOM)
 *   <AppRouter />         → RouterProvider + todas as rotas (lazy-loaded)
 * </AuthProvider>
 * ```
 *
 * Por que `AuthProvider` é o mais externo?
 * - `AppRouter` precisa do AuthContext para os guards de rota (`PrivateRoute`).
 * - `LogoutBridge` precisa do AuthContext para obter `logout`.
 * - Portanto, ambos devem ser descendentes do `AuthProvider`.
 *
 * @returns {JSX.Element}
 */
function App() {
  return (
    <AuthProvider>
      {/*
       * AuthContext.Consumer como render-prop para extrair `logout`
       * sem adicionar um hook no componente App (mantém App livre de
       * qualquer lógica de contexto direta).
       */}
      <AuthContext.Consumer>
        {({ logout }) => <LogoutBridge logout={logout} />}
      </AuthContext.Consumer>

      {/*
       * AppRouter encapsula createBrowserRouter + RouterProvider.
       * Todas as rotas são lazy-loaded internamente — nenhuma rota
       * é importada aqui para manter este arquivo enxuto.
       */}
      <AppRouter />
    </AuthProvider>
  );
}

export default App;