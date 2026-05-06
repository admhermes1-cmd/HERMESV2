import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useUserFormViewModel } from '../../viewmodels/useUserFormViewModel';
import { Button }        from '../components/common/Button';
import { InputField }    from '../components/common/InputField';
import { LoadingSpinner} from '../components/common/LoadingSpinner';
import { APP_CONSTANTS } from '../../core/constants/appConstants';
import styles from './UserFormPage.module.css';

/**
 * Página de criação e edição de usuários — acessível apenas por administradores.
 *
 * <p>Atua tanto como formulário de criação (quando não há {@code :id} na rota)
 * quanto como formulário de edição. Em modo edição, o campo de e-mail é somente-
 * leitura, refletindo a imutabilidade imposta pelo backend.</p>
 *
 * <p>A senha nunca é exibida nem gerenciada neste formulário — ela é gerada
 * automaticamente pelo servidor e enviada por e-mail ao usuário.</p>
 *
 * @component
 * @returns {JSX.Element}
 */
export default function UserFormPage() {
  const navigate = useNavigate();

  const {
    fields,
    fieldErrors,
    submitError,
    isLoading,
    isSubmitting,
    isEditMode,
    handleChange,
    handleSubmit,
  } = useUserFormViewModel();

  const pageTitle = isEditMode ? 'Editar usuário' : 'Novo usuário';

  if (isLoading) {
    return <LoadingSpinner fullscreen overlay />;
  }

  return (
    <main className={styles.page} aria-labelledby="form-title">
      {/* Cabeçalho */}
      <header className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate(APP_CONSTANTS.ROUTES.USERS)}
          aria-label="Voltar para listagem de usuários"
        >
          Usuários
        </Button>
        <h1 id="form-title" className={styles.title}>{pageTitle}</h1>
      </header>

      {/* Erro de submissão */}
      {submitError && (
        <div role="alert" aria-live="assertive" className={styles.errorBanner}>
          {submitError}
        </div>
      )}

      {/* Formulário */}
      <form
        className={styles.card}
        onSubmit={handleSubmit}
        noValidate
        aria-label={pageTitle}
      >
        <div className={styles.grid}>
          {/* Nome */}
          <InputField
            label="Nome completo"
            name="name"
            type="text"
            value={fields.name}
            onChange={handleChange}
            error={fieldErrors.name}
            required
            autoComplete="name"
          />

          {/* E-mail */}
          <InputField
            label="E-mail"
            name="email"
            type="email"
            value={fields.email}
            onChange={handleChange}
            error={fieldErrors.email}
            required={!isEditMode}
            readOnly={isEditMode}
            hint={isEditMode ? 'O e-mail não pode ser alterado após a criação.' : 'A senha de acesso será enviada para este endereço.'}
            autoComplete="email"
          />

          {/* Papel */}
          <div className={styles.fieldGroup}>
            <label htmlFor="role" className={styles.label}>
              Papel <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <select
              id="role"
              name="role"
              className={`${styles.select} ${fieldErrors.role ? styles.selectError : ''}`}
              value={fields.role}
              onChange={handleChange}
              required
              aria-required="true"
              aria-describedby={fieldErrors.role ? 'role-error' : undefined}
            >
              <option value="USER">Usuário</option>
              <option value="ADMIN">Administrador</option>
            </select>
            {fieldErrors.role && (
              <span id="role-error" className={styles.error} role="alert">
                {fieldErrors.role}
              </span>
            )}
          </div>

          {/* Status */}
          <div className={styles.fieldGroup}>
            <span className={styles.label}>Status</span>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="isActive"
                checked={fields.isActive}
                onChange={handleChange}
                className={styles.checkbox}
                aria-label="Conta ativa"
              />
              <span>Conta ativa</span>
            </label>
          </div>
        </div>

        {/* Informativo — senha */}
        {!isEditMode && (
          <p className={styles.passwordHint} aria-live="polite">
            Uma senha temporária de 8 caracteres será gerada automaticamente e enviada
            ao e-mail informado após a criação do usuário.
          </p>
        )}

        {/* Rodapé do formulário */}
        <footer className={styles.formFooter}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(APP_CONSTANTS.ROUTES.USERS)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            isLoading={isSubmitting}
          >
            {isEditMode ? 'Salvar alterações' : 'Criar usuário'}
          </Button>
        </footer>
      </form>
    </main>
  );
}
