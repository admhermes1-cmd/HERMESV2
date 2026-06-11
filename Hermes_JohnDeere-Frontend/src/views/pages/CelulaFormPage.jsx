import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Users } from 'lucide-react';
import { useCelulaFormViewModel } from '../../viewmodels/useCelulaFormViewModel';
import { useAuth }   from '../../core/auth/useAuth';
import Button        from '../components/common/Button';
import InputField    from '../components/common/InputField';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ROUTES }    from '../../core/constants/appConstants';
import styles        from './CelulaFormPage.module.css';

/**
 * Página de criação e edição de células organizacionais.
 *
 * Campos:
 *  - Nome da célula (texto livre, obrigatório)
 *  - Gestor (dropdown com usuários ativos de role GESTOR, opcional — apenas ADMIN pode atribuir/trocar)
 *
 * Em modo edição, exibe a lista de usuários vinculados (read-only).
 * O botão Salvar permanece desabilitado enquanto o Nome estiver vazio.
 * GESTOR só acessa esta página para editar a própria célula e não pode trocar o gestor
 * (o campo é exibido como somente leitura nesse caso — validado também no backend).
 *
 * @component
 * @returns {JSX.Element}
 */
export default function CelulaFormPage() {
  const navigate = useNavigate();
  const { isGestor } = useAuth();

  const {
    fields,
    fieldErrors,
    submitError,
    isLoading,
    isSubmitting,
    isEditMode,
    gestores,
    usuarios,
    handleChange,
    handleSubmit,
  } = useCelulaFormViewModel();

  const pageTitle = isEditMode ? 'Editar célula' : 'Nova célula';

  /** GESTOR não pode reatribuir o gestor da própria célula — campo exibido como somente leitura. */
  const isGestorFieldReadOnly = isGestor && isEditMode;

  /** O botão Salvar só habilita quando o Nome estiver preenchido — Gestor é opcional. */
  const isSaveDisabled = isSubmitting || !fields.nome.trim();

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
          onClick={() => navigate(ROUTES.CELULAS)}
          aria-label="Voltar para listagem de células"
        >
          Células
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
            label="Nome da célula"
            name="nome"
            type="text"
            value={fields.nome}
            onChange={handleChange}
            error={fieldErrors.nome}
            required
            placeholder="Ex: C1, C2, Equipe Alpha…"
            autoComplete="off"
          />

          {/* Gestor */}
          <div className={styles.fieldGroup}>
            <label htmlFor="gestorId" className={styles.label}>
              Gestor
            </label>
            {isGestorFieldReadOnly ? (
              <>
                <input
                  id="gestorId"
                  className={styles.select}
                  value="Você"
                  readOnly
                  disabled
                />
                <span className={styles.fieldHint}>
                  Apenas um administrador pode trocar o gestor desta célula.
                </span>
              </>
            ) : (
              <>
                <select
                  id="gestorId"
                  name="gestorId"
                  className={[
                    styles.select,
                    fieldErrors.gestorId ? styles.selectError : '',
                  ].filter(Boolean).join(' ')}
                  value={fields.gestorId}
                  onChange={handleChange}
                  aria-describedby={fieldErrors.gestorId ? 'gestorId-error' : undefined}
                >
                  <option value="">Sem gestor</option>
                  {gestores.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — {g.email}
                    </option>
                  ))}
                </select>
                {fieldErrors.gestorId && (
                  <span id="gestorId-error" className={styles.fieldError} role="alert">
                    {fieldErrors.gestorId}
                  </span>
                )}
                {gestores.length === 0 && (
                  <span className={styles.fieldHint}>
                    Nenhum usuário com role Gestor encontrado. Crie um gestor antes de criar a célula.
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Rodapé do formulário */}
        <footer className={styles.formFooter}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(ROUTES.CELULAS)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            isLoading={isSubmitting}
            disabled={isSaveDisabled}
            aria-disabled={isSaveDisabled}
          >
            {isEditMode ? 'Salvar alterações' : 'Criar célula'}
          </Button>
        </footer>
      </form>

      {/* ── Usuários vinculados (modo edição, read-only) ── */}
      {isEditMode && (
        <section className={styles.usuariosSection} aria-labelledby="usuarios-title">
          <h2 id="usuarios-title" className={styles.sectionTitle}>
            <Users size={16} strokeWidth={1.75} aria-hidden="true" />
            Usuários vinculados
            <span className={styles.usuariosCount} aria-label={`${usuarios.length} usuários`}>
              {usuarios.length}
            </span>
          </h2>

          {usuarios.length === 0 ? (
            <p className={styles.usuariosEmpty}>Nenhum usuário vinculado a esta célula.</p>
          ) : (
            <div className={styles.tableWrapper} role="region" aria-label="Usuários da célula">
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Matrícula</th>
                    <th scope="col">Nome</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Papel</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td className={styles.matriculaCell}>
                        {u.matricula ?? '—'}
                      </td>
                      <td>{u.name}</td>
                      <td className={styles.emailCell}>{u.email}</td>
                      <td>
                        <span className={[
                          styles.roleBadge,
                          u.role === 'ADMIN'  ? styles.roleAdmin  :
                          u.role === 'GESTOR' ? styles.roleGestor :
                          styles.roleUser,
                        ].join(' ')}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={[
                          styles.statusBadge,
                          u.isActive ? styles.statusActive : styles.statusInactive,
                        ].join(' ')}>
                          {u.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
