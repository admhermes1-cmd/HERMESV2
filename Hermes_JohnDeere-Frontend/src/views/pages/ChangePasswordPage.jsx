import { Eye, EyeOff, Wand2, Copy, Check, ShieldCheck, LogOut } from 'lucide-react';
import { useChangePasswordViewModel } from '../../viewmodels/useChangePasswordViewModel';
import Button        from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import styles from './ChangePasswordPage.module.css';

/**
 * Tela de troca obrigatória de senha no primeiro acesso ao HERMES.
 *
 * <p>Exibe um formulário com checklist de regras em tempo real, strength meter,
 * gerador de senha segura e toggle de visibilidade. Após o envio bem-sucedido,
 * transita para uma tela de confirmação com botão de copiar senha.</p>
 *
 * <p>Um timer de inatividade de 5 minutos faz logout automático caso o usuário
 * não interaja com a página.</p>
 *
 * @component
 * @returns {JSX.Element}
 */
export default function ChangePasswordPage() {
  const {
    step,
    currentPassword,
    newPassword,
    confirmPassword,
    showCurrent,
    showNew,
    showConfirm,
    rules,
    strength,
    submitError,
    fieldErrors,
    isSubmitting,
    copied,
    inactivityLeft,
    handleChange,
    handleToggleShow,
    handleGenerate,
    handleSubmit,
    handleCopy,
    handleConfirm,
  } = useChangePasswordViewModel();

  // ── Strength meter ────────────────────────────────────────────────────────
  const strengthPercent = Math.round((strength / rules.length) * 100);
  const strengthLabel =
    strength <= 2 ? 'Fraca' :
    strength <= 4 ? 'Razoável' :
    strength <= 6 ? 'Boa' : 'Forte';
  const strengthVariant =
    strength <= 2 ? styles.strengthWeak :
    strength <= 4 ? styles.strengthFair :
    strength <= 6 ? styles.strengthGood : styles.strengthStrong;

  // ── Formato do timer ──────────────────────────────────────────────────────
  const minutes = Math.floor(inactivityLeft / 60);
  const seconds = String(inactivityLeft % 60).padStart(2, '0');

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card} role="main" aria-labelledby="success-title">
          <div className={styles.successIcon} aria-hidden="true">
            <ShieldCheck size={48} strokeWidth={1.5} />
          </div>

          <h1 id="success-title" className={styles.title}>Senha definida com sucesso!</h1>
          <p className={styles.subtitle}>
            Guarde sua senha em um local seguro antes de continuar.
          </p>

          <div className={styles.passwordDisplay} aria-label="Sua nova senha">
            <code className={styles.passwordText}>{newPassword}</code>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              aria-label={copied ? 'Senha copiada' : 'Copiar senha'}
            >
              {copied
                ? <><Check size={16} /> Copiado!</>
                : <><Copy size={16} /> Copiar</>
              }
            </button>
          </div>

          <p className={styles.copyHint} aria-live="polite">
            {copied
              ? '✓ Senha copiada para a área de transferência.'
              : 'Você também pode usar Ctrl+C após selecionar a senha acima.'}
          </p>

          <Button
            variant="primary"
            onClick={handleConfirm}
            className={styles.confirmBtn}
          >
            Confirmar e ir para o Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>

        {/* Cabeçalho */}
        <header className={styles.header}>
          <ShieldCheck size={32} strokeWidth={1.5} className={styles.headerIcon} aria-hidden="true" />
          <div>
            <h1 className={styles.title}>Defina sua senha de acesso</h1>
            <p className={styles.subtitle}>
              Por segurança, você precisa criar uma senha pessoal antes de continuar.
            </p>
          </div>
        </header>

        {/* Timer de inatividade */}
        <div
          className={`${styles.timer} ${inactivityLeft <= 60 ? styles.timerUrgent : ''}`}
          role="timer"
          aria-live="polite"
          aria-label={`Sessão expira em ${minutes}:${seconds}`}
        >
          <LogOut size={14} aria-hidden="true" />
          Sessão expira em {minutes}:{seconds}
        </div>

        {/* Erro de submissão */}
        {submitError && (
          <div role="alert" aria-live="assertive" className={styles.errorBanner}>
            {submitError}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} noValidate aria-label="Formulário de troca de senha">

          {/* Senha atual */}
          <div className={styles.fieldGroup}>
            <label htmlFor="currentPassword" className={styles.label}>
              Senha temporária recebida por e-mail <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                className={`${styles.input} ${fieldErrors.current ? styles.inputError : ''}`}
                value={currentPassword}
                onChange={handleChange('current')}
                autoComplete="current-password"
                aria-required="true"
                aria-describedby={fieldErrors.current ? 'current-error' : undefined}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => handleToggleShow('current')}
                aria-label={showCurrent ? 'Ocultar senha atual' : 'Mostrar senha atual'}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.current && (
              <span id="current-error" className={styles.fieldError} role="alert">
                {fieldErrors.current}
              </span>
            )}
          </div>

          {/* Nova senha + gerador */}
          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="newPassword" className={styles.label}>
                Nova senha <span className={styles.required} aria-hidden="true">*</span>
              </label>
              <button
                type="button"
                className={styles.generateBtn}
                onClick={handleGenerate}
                aria-label="Gerar senha segura automaticamente"
              >
                <Wand2 size={14} aria-hidden="true" />
                Gerar senha segura
              </button>
            </div>
            <div className={styles.inputWrapper}>
              <input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                className={`${styles.input} ${fieldErrors.new ? styles.inputError : ''}`}
                value={newPassword}
                onChange={handleChange('new')}
                autoComplete="new-password"
                aria-required="true"
                aria-describedby="password-rules new-error"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => handleToggleShow('new')}
                aria-label={showNew ? 'Ocultar nova senha' : 'Mostrar nova senha'}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.new && (
              <span id="new-error" className={styles.fieldError} role="alert">
                {fieldErrors.new}
              </span>
            )}

            {/* Strength meter */}
            {newPassword.length > 0 && (
              <div className={styles.strengthMeter} aria-label={`Força da senha: ${strengthLabel}`}>
                <div className={styles.strengthBar}>
                  <div
                    className={`${styles.strengthFill} ${strengthVariant}`}
                    style={{ width: `${strengthPercent}%` }}
                    role="progressbar"
                    aria-valuenow={strengthPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className={`${styles.strengthLabel} ${strengthVariant}`}>
                  {strengthLabel}
                </span>
              </div>
            )}
          </div>

          {/* Confirmação */}
          <div className={styles.fieldGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirmar nova senha <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                className={`${styles.input} ${fieldErrors.confirm ? styles.inputError : ''}`}
                value={confirmPassword}
                onChange={handleChange('confirm')}
                autoComplete="new-password"
                aria-required="true"
                aria-describedby={fieldErrors.confirm ? 'confirm-error' : undefined}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => handleToggleShow('confirm')}
                aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.confirm && (
              <span id="confirm-error" className={styles.fieldError} role="alert">
                {fieldErrors.confirm}
              </span>
            )}
          </div>

          {/* Checklist de regras */}
          <fieldset className={styles.rulesBox} id="password-rules">
            <legend className={styles.rulesTitle}>Requisitos da senha</legend>
            <ul className={styles.rulesList} role="list">
              {rules.map(rule => (
                <li
                  key={rule.id}
                  className={`${styles.ruleItem} ${rule.met ? styles.ruleMet : styles.ruleUnmet}`}
                  aria-label={`${rule.label}: ${rule.met ? 'cumprido' : 'não cumprido'}`}
                >
                  <span className={styles.ruleIcon} aria-hidden="true">
                    {rule.met ? '✓' : '○'}
                  </span>
                  {rule.label}
                </li>
              ))}
            </ul>
          </fieldset>

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            Definir nova senha
          </Button>
        </form>
      </div>
    </div>
  );
}
