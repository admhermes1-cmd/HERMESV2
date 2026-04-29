import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

import { useLoginViewModel } from '../../viewmodels/useLoginViewModel';
import Button from '../components/common/Button';

import styles from './LoginPage.module.css';

/**
 * @component LoginPage
 * @description Página de autenticação do sistema HERMES.
 *
 * Responsável exclusivamente pela camada de apresentação do fluxo de login.
 * Toda a lógica de negócio (validação, chamada de API, redirecionamento pós-login)
 * é delegada ao ViewModel `useLoginViewModel`.
 *
 * Renderizada dentro do `AuthLayout` via `<Outlet />`, ocupando o painel direito
 * da tela dividida. O `AppRouter` e o `PrivateRoute` garantem que usuários já
 * autenticados nunca cheguem aqui.
 *
 * @note Os campos de e-mail e senha são renderizados com `<input>` nativo (não via
 * InputField) para que o layout "ícone + input + toggle" seja montado como flexbox,
 * garantindo centralização vertical perfeita dos ícones independente da altura real
 * do elemento. O componente InputField encapsula seu <input> internamente, o que
 * impossibilita injetar ícones como siblings no mesmo contexto flex.
 *
 * @dependencies
 * - `useLoginViewModel` — fornece estado do formulário, loading, erro e handlers
 * - `Button` — botão de submit com suporte a estado de loading
 * - `lucide-react` — ícones Mail, Lock, Eye, EyeOff, AlertCircle
 *
 * @state_local
 * - `showPassword` {boolean} — controla visibilidade do campo de senha (único estado local)
 *
 * @accessibility
 * - Foco automático no campo de e-mail ao montar o componente
 * - Banner de erro global com `role="alert"` e `aria-live="assertive"`
 * - Botão de toggle de senha com `aria-label` dinâmico
 * - Labels explicitamente associados via `htmlFor` / `id`
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { form, isLoading, error, handleChange, handleSubmit } = useLoginViewModel(navigate);

  // Único estado local: visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);

  // Foco automático no e-mail ao montar
  const emailInputRef = useRef(null);
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  return (
    <div className={styles.container}>
      <div className={styles.card}>

        {/* ── Cabeçalho ─────────────────────────────────────────────── */}
        <header className={styles.header}>
          <div className={styles.logoMark} aria-hidden="true">
            <span className={styles.logoH}>H</span>
          </div>
          <h1 className={styles.title}>Bem-vindo ao HERMES</h1>
          <p className={styles.subtitle}>Faça login para continuar</p>
        </header>

        {/* ── Banner de erro global ──────────────────────────────────── */}
        {error && (
          <div className={styles.errorBanner} role="alert" aria-live="assertive">
            <AlertCircle size={16} className={styles.errorBannerIcon} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Formulário ────────────────────────────────────────────── */}
        <form
          className={styles.form}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Formulário de login"
        >

          {/* Campo de e-mail ──────────────────────────────────────── */}
          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>
              E-mail <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div className={styles.inputRow}>
              <span className={styles.inputIcon} aria-hidden="true">
                <Mail size={17} />
              </span>
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                className={styles.input}
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                aria-required="true"
              />
            </div>
          </div>

          {/* Campo de senha ───────────────────────────────────────── */}
          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.label}>
              Senha <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div className={styles.inputRow}>
              <span className={styles.inputIcon} aria-hidden="true">
                <Lock size={17} />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                aria-required="true"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Botão de submit */}
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isLoading}
          >
            Entrar
          </Button>
        </form>

        {/* ── Rodapé discreto ───────────────────────────────────────── */}
        <footer className={styles.footer}>
          <p className={styles.footerText}>Acesso restrito a usuários autorizados</p>
        </footer>

      </div>
    </div>
  );
}