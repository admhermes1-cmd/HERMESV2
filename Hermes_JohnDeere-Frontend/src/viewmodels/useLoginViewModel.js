import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth/useAuth';
import { ROUTES } from '../core/constants/appConstants';

/**
 * ViewModel para a tela de Login.
 *
 * Retorna um objeto ACHADO (flat) para compatibilidade com a LoginPage,
 * que desestrutura os campos diretamente do hook:
 *   const { form, isLoading, error, handleChange, handleSubmit } = useLoginViewModel(navigate)
 *
 * ATENÇÃO — rota de fallback pós-login:
 *   ROUTES.DASHBOARD = '/dashboard', mas o AppRouter mapeia o dashboard em '/'.
 *   Usar ROUTES.DASHBOARD causaria 404. O fallback correto é sempre '/'.
 *
 * O PrivateRoute injeta um objeto Location completo em `location.state.from`
 * ao interceptar rotas protegidas. Por isso extraímos `.pathname` antes de
 * navegar — passar um objeto Location para navigate() tem comportamento
 * inconsistente entre versões do React Router v6.
 *
 * FLUXO DE mustChangePassword:
 *   Após login bem-sucedido, AuthContext.login() retorna o objeto User já
 *   populado. Se `mustChangePassword` for true (conta nova ou senha resetada
 *   pelo admin), o usuário é redirecionado para ROUTES.CHANGE_PASSWORD
 *   antes de qualquer outra navegação. Isso evita depender do timing de
 *   re-render do React state para ler user do contexto.
 *
 * @param {Function} navigate - Retorno de useNavigate() passado pela View
 *
 * @returns {{
 *   form: { email: string, password: string },
 *   isLoading: boolean,
 *   error: string | null,
 *   handleChange: (field: 'email' | 'password', value: string) => void,
 *   handleSubmit: (e: React.FormEvent) => Promise<void>
 * }}
 */
export function useLoginViewModel(navigate) {
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Atualiza um campo do formulário e limpa qualquer erro visível.
   * @param {'email' | 'password'} field
   * @param {string} value
   */
  function handleChange(field, value) {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Submete o formulário de login.
   *
   * Em sucesso:
   *   1. Se `mustChangePassword` for true → redireciona para ROUTES.CHANGE_PASSWORD,
   *      ignorando qualquer rota de origem (location.state.from).
   *   2. Caso contrário → navega para a rota de origem ou '/dashboard'.
   *
   * Em falha: expõe a mensagem de erro para a View.
   *
   * @param {React.FormEvent} e
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // AuthContext.login() retorna o User já construído via createUser(),
      // evitando depender do timing de atualização do React state.
      const loggedUser = await login(form.email.trim(), form.password);

      // Troca de senha obrigatória — conta nova ou senha resetada pelo admin.
      // Tem prioridade sobre qualquer rota de origem (location.state.from).
      if (loggedUser?.mustChangePassword) {
        navigate(ROUTES.CHANGE_PASSWORD, { replace: true });
        return;
      }

      // state.from é um objeto Location injetado pelo PrivateRoute — extrair .pathname
      const from = location.state?.from;
      const destination =
        typeof from === 'string'
          ? from
          : from?.pathname ?? '/dashboard'; // '/dashboard' = DashboardPage no AppRouter

      navigate(destination, { replace: true });
    } catch (err) {
      if (err?.details) {
        console.error('[useLoginViewModel] Detalhes do erro:', err.details);
      }
      setError(err?.message ?? 'Erro inesperado ao realizar login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  // Retorno flat — a LoginPage desestrutura tudo no nível raiz
  return {
    form,
    isLoading,
    error,
    handleChange,
    handleSubmit,
  };
}
