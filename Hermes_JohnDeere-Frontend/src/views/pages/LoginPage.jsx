import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

import { useLoginViewModel } from '../../viewmodels/useLoginViewModel';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';

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
 * @dependencies
 * - `useLoginViewModel` — fornece estado do formulário, loading, erro e handlers
 * - `Button` — botão de submit com suporte a estado de loading
 * - `InputField` — campo de formulário com suporte a erro inline
 * - `lucide-react` — ícones Mail, Lock, Eye, EyeOff, AlertCircle
 *
 * @state_local
 * - `showPassword` {boolean} — controla visibilidade do campo de senha (único estado local)
 *
 * @accessibility
 * - Foco automático no campo de e-mail ao montar o componente
 * - Banner de erro global com `role="alert"` para leitores de tela
 * - Botão de toggle de senha com `aria-label` descritivo
 * - Labels associados a todos os campos via componente InputField
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { form, isLoading, error, handleChange, handleSubmit } = useLoginViewModel(navigate);

  // Único estado local: controle de visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);

  // Ref para foco automático no primeiro campo ao montar
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
          {/* Campo de e-mail */}
          <div className={styles.fieldWrapper}>
            <span className={styles.fieldIcon} aria-hidden="true">
              <Mail size={17} />
            </span>
            <InputField
              label="E-mail"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="seu@email.com"
              required
              ref={emailInputRef}
            />
          </div>

          {/* Campo de senha com toggle de visibilidade */}
          <div className={styles.fieldWrapper}>
            <span className={styles.fieldIcon} aria-hidden="true">
              <Lock size={17} />
            </span>
            <InputField
              label="Senha"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={0}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
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