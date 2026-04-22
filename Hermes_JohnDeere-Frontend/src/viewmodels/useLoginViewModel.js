import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth/useAuth';
import { ROUTES } from '../core/constants/appConstants';

/**
 * ViewModel para a tela de Login.
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
   * Atualiza um campo do formulário e limpa qualquer erro exibido.
   * @param {'email' | 'password'} field
   * @param {string} value
   */
  function handleChange(field, value) {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Submete o formulário de login.
   * Em sucesso: persiste o usuário via useAuth e navega para a rota de origem ou dashboard.
   * Em falha: expõe a mensagem de erro para a View.
   * @param {React.FormEvent} e
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(form.email.trim(), form.password);

      // Redireciona para a rota original interceptada pelo guard, ou para o dashboard
      const destination = location.state?.from ?? ROUTES.DASHBOARD;
      navigate(destination, { replace: true });
    } catch (err) {
      // Loga detalhes técnicos no console para diagnóstico
      if (err?.details) {
        console.error('[useLoginViewModel] Detalhes do erro:', err.details);
      }
      setError(err?.message ?? 'Erro inesperado ao realizar login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  return {
    state: {
      form,
      isLoading,
      error,
    },
    actions: {
      handleChange,
      handleSubmit,
    },
  };
}