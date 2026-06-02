import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useUserFormViewModel } from '../../viewmodels/useUserFormViewModel';
import Button        from '../components/common/Button';
import InputField    from '../components/common/InputField';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ROUTES, UI } from '../../core/constants/appConstants';
import styles        from './UserFormPage.module.css';

/**
 * Página de criação e edição de usuários — acessível apenas por ADMIN e GESTOR.
 *
 * Campos:
 *  - Nome completo (obrigatório)
 *  - E-mail (obrigatório na criação, read-only na edição)
 *  - Papel/Role (ADMIN, GESTOR ou USER — GESTOR não pode selecionar ADMIN/GESTOR)
 *  - Status ativo (checkbox)
 *  - Cargo (opcional)
 *  - Célula (obrigatório na criação, editável na edição)
 *
 * A senha e a matrícula nunca são gerenciadas neste formulário — ambas são
 * geradas automaticamente pelo servidor.
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
    celulas,
    handleChange,
    handleSubmit,
  } = useUserFormViewModel();

  const pageTitle = isEditMode ? 'Editar usuário' : 'Novo usuário';

  if (isLoading) {
    return <LoadingSpinner fullscreen overlay />;
  }

  return (
    <main className={styles.page} aria-labelledby="form-title">

      {/* ── Cabeçalho ── */}
      <header className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate(ROUTES.USERS)}
          aria-label="Voltar para listagem de usuários"
        >
          Usuários
        </Button>
        <h1 id="form-title" className={styles.title}>{pageTitle}</h1>
      </header>

      {/* ── Erro de submissão ── */}
      {submitError && (
        <div role="alert" aria-live="assertive" className={styles.errorBanner}>
          {submitError}
        </div>
      )}

      {/* ── Formulário ── */}
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
            hint={
              isEditMode
                ? 'O e-mail não pode ser alterado após a criação.'
                : 'A senha de acesso será enviada para este endereço.'
            }
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
              className={[styles.select, fieldErrors.role ? styles.selectError : '']
                .filter(Boolean).join(' ')}
              value={fields.role}
              onChange={handleChange}
              required
              aria-required="true"
              aria-describedby={fieldErrors.role ? 'role-error' : undefined}
            >
              <option value="USER">{UI.USER_ROLE_LABEL.USER}</option>
              <option value="GESTOR">{UI.USER_ROLE_LABEL.GESTOR}</option>
              <option value="ADMIN">{UI.USER_ROLE_LABEL.ADMIN}</option>
            </select>
            {fieldErrors.role && (
              <span id="role-error" className={styles.fieldError} role="alert">
                {fieldErrors.role}
              </span>
            )}
          </div>

          {/* Cargo */}
          <InputField
            label="Cargo"
            name="cargo"
            type="text"
            value={fields.cargo}
            onChange={handleChange}
            error={fieldErrors.cargo}
            placeholder="Ex: Desenvolvedor Sênior"
            hint="Campo opcional."
            autoComplete="organization-title"
          />

          {/* Célula */}
          <div className={styles.fieldGroup}>
            <label htmlFor="celulaId" className={styles.label}>
              Célula{!isEditMode && (
                <span aria-hidden="true" className={styles.required}> *</span>
              )}
            </label>
            <select
              id="celulaId"
              name="celulaId"
              className={[styles.select, fieldErrors.celulaId ? styles.selectError : '']
                .filter(Boolean).join(' ')}
              value={fields.celulaId}
              onChange={handleChange}
              required={!isEditMode}
              aria-required={!isEditMode}
              aria-describedby={fieldErrors.celulaId ? 'celulaId-error' : 'celulaId-hint'}
            >
              <option value="">Selecione uma célula…</option>
              {celulas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.gestor ? ` — Gestor: ${c.gestor.nome}` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.celulaId ? (
              <span id="celulaId-error" className={styles.fieldError} role="alert">
                {fieldErrors.celulaId}
              </span>
            ) : (
              <span id="celulaId-hint" className={styles.fieldHint}>
                {isEditMode
                  ? 'Altere a célula do usuário se necessário.'
                  : 'Todo usuário deve pertencer a uma célula.'}
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

        {/* Informativo — senha e matrícula */}
        {!isEditMode && (
          <p className={styles.passwordHint} aria-live="polite">
            Uma senha temporária de 8 caracteres e uma matrícula única serão geradas
            automaticamente e enviadas ao e-mail informado após a criação do usuário.
          </p>
        )}

        {/* Rodapé do formulário */}
        <footer className={styles.formFooter}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(ROUTES.USERS)}
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
