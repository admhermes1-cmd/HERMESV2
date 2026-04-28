import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth/useAuth';
import { authService } from '../services/authService';

/**
 * ViewModel para a tela de Login.
 *
 * ATENÇÃO — rota de fallback pós-login:
 *   ROUTES.DASHBOARD está definido como '/dashboard', mas o AppRouter mapeia o
 *   dashboard na rota raiz '/'. Usar ROUTES.DASHBOARD aqui causaria um 404.
 *   O fallback correto é '/' (HOME), que o AppRouter resolve para DashboardPage.
 *
 * @param {Function} navigate - Função de navegação do React Router (useNavigate)
 *
 * @returns {{
 *   state: {
 *     form: { email: string, password: string },
 *     isLoading: boolean,
 *     error: string | null
 *   },
 *   actions: {
 *     handleChange: (field: 'email' | 'password', value: string) => void,
 *     handleSubmit: (e: React.FormEvent) => Promise<void>
 *   }
 * }}
 */
export function useLoginViewModel(navigate) {
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Atualiza um campo do formulário e limpa o erro exibido.
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
   * O PrivateRoute injeta um objeto Location completo em `state.from` ao
   * interceptar uma rota protegida. Por isso extraímos `.pathname` antes de
   * navegar — passar um objeto Location para navigate() pode causar
   * comportamento inesperado em algumas versões do React Router v6.
   *
   * @param {React.FormEvent} e
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { user, token, refreshToken } = await authService.login({
        email: form.email.trim(),
        password: form.password,
      });

      login({ user, token, refreshToken });

      // state.from é um objeto Location — extraímos apenas pathname
      const from = location.state?.from;
      const destination =
        typeof from === 'string'
          ? from
          : from?.pathname ?? '/'; // fallback: '/', NÃO ROUTES.DASHBOARD ('/dashboard' não existe no AppRouter)

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

  return {
    state: { form, isLoading, error },
    actions: { handleChange, handleSubmit },
  };
}