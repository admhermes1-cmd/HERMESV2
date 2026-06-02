import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { useCelulaListViewModel } from '../../viewmodels/useCelulaListViewModel';
import { useAuth }                from '../../core/auth/useAuth';
import Button                     from '../components/common/Button';
import LoadingSpinner             from '../components/common/LoadingSpinner';
import { ROUTES, UI }             from '../../core/constants/appConstants';
import styles                     from './CelulasPage.module.css';

/**
 * Página de listagem de células organizacionais.
 *
 * Exibe uma tabela paginada com nome, gestor, total de usuários e ações.
 * Botão "Nova Célula" visível apenas para ADMIN.
 * Modal de confirmação antes de excluir, com aviso sobre usuários sem célula.
 *
 * @component
 * @returns {JSX.Element}
 */
export default function CelulasPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const {
    celulas,
    total,
    page,
    limit,
    isLoading,
    error,
    deleteTarget,
    isDeleting,
    deleteError,
    successBanner,
    setPage,
    confirmDelete,
    cancelDelete,
    executeDelete,
  } = useCelulaListViewModel();

  const totalPages = Math.ceil(total / limit);

  return (
    <main className={styles.page} aria-labelledby="page-title">

      {/* ── Cabeçalho ── */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Building2 size={22} strokeWidth={1.75} className={styles.titleIcon} aria-hidden="true" />
          <h1 id="page-title" className={styles.title}>Células</h1>
          <span className={styles.totalBadge} aria-label={`${total} células no total`}>
            {total}
          </span>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate(ROUTES.CELULA_NEW)}
            aria-label="Criar nova célula"
          >
            Nova Célula
          </Button>
        )}
      </header>

      {/* ── Banner de sucesso ── */}
      {successBanner && (
        <div role="status" aria-live="polite" className={styles.successBanner}>
          {successBanner}
        </div>
      )}

      {/* ── Erro de carregamento ── */}
      {error && (
        <div role="alert" aria-live="assertive" className={styles.errorBanner}>
          {error}
        </div>
      )}

      {/* ── Conteúdo ── */}
      {isLoading ? (
        <LoadingSpinner />
      ) : celulas.length === 0 ? (
        <div className={styles.empty} role="status">
          <Building2 size={40} strokeWidth={1.25} className={styles.emptyIcon} aria-hidden="true" />
          <p className={styles.emptyText}>Nenhuma célula cadastrada.</p>
          {isAdmin && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate(ROUTES.CELULA_NEW)}
            >
              Criar primeira célula
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* ── Tabela ── */}
          <div className={styles.tableWrapper} role="region" aria-label="Lista de células">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Gestor</th>
                  <th scope="col" className={styles.centerCol}>
                    <Users size={14} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.srOnly}>Usuários</span>
                  </th>
                  <th scope="col" className={styles.actionsCol}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {celulas.map((celula) => (
                  <tr key={celula.id} className={styles.row}>
                    <td className={styles.nameCell}>
                      <span className={styles.celulaNome}>{celula.nome}</span>
                    </td>
                    <td className={styles.gestorCell}>
                      {celula.gestor ? (
                        <div className={styles.gestorInfo}>
                          <span className={styles.gestorNome}>{celula.gestor.nome}</span>
                          <span className={styles.gestorEmail}>{celula.gestor.email}</span>
                        </div>
                      ) : (
                        <span className={styles.semGestor}>Sem gestor</span>
                      )}
                    </td>
                    <td className={styles.centerCol}>
                      <span className={styles.usuarioCount}>{celula.totalUsuarios}</span>
                    </td>
                    <td className={styles.actionsCell}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => navigate(ROUTES.CELULA_EDIT(celula.id))}
                        aria-label={`Editar célula ${celula.nome}`}
                        title="Editar"
                      />
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => confirmDelete(celula.id)}
                          aria-label={`Excluir célula ${celula.nome}`}
                          title="Excluir"
                          className={styles.deleteBtn}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Paginação ── */}
          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Paginação de células">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                Anterior
              </Button>
              <span className={styles.paginationInfo} aria-current="page">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="Próxima página"
              >
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}

      {/* ── Modal de confirmação de exclusão ── */}
      {deleteTarget && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div className={styles.modal}>
            <div className={styles.modalIcon} aria-hidden="true">
              <AlertTriangle size={28} strokeWidth={1.75} />
            </div>
            <h2 id="delete-dialog-title" className={styles.modalTitle}>
              Excluir célula?
            </h2>
            <p id="delete-dialog-desc" className={styles.modalDesc}>
              Esta ação é permanente. Os usuários vinculados a esta célula
              ficarão <strong>sem célula atribuída</strong> e precisarão ser
              realocados manualmente.
            </p>

            {deleteError && (
              <p role="alert" className={styles.modalError}>
                {deleteError}
              </p>
            )}

            <div className={styles.modalActions}>
              <Button
                variant="ghost"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={executeDelete}
                isLoading={isDeleting}
                aria-label="Confirmar exclusão da célula"
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
