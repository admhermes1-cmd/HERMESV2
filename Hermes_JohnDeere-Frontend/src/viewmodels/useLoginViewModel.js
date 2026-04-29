import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth/useAuth';

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
   * Em sucesso: persiste autenticação e navega para a rota de origem ou '/'.
   * Em falha: expõe a mensagem de erro para a View.
   * @param {React.FormEvent} e
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Delega autenticação ao contexto — login(email, password) chama a API
      // e persiste usuário + token internamente. Erros são capturados abaixo.
      await login(form.email.trim(), form.password);

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
