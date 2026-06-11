import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  UserCog,
} from 'lucide-react';
import { useCelulaListViewModel } from '../../viewmodels/useCelulaListViewModel';
import { useAuth }                from '../../core/auth/useAuth';
import Button                     from '../components/common/Button';
import Badge                      from '../components/common/Badge';
import Table                      from '../components/common/Table';
import Modal                      from '../components/common/Modal';
import { ROUTES }                 from '../../core/constants/appConstants';
import styles                     from './CelulasPage.module.css';

/**
 * Página de listagem de células organizacionais.
 *
 * Segue o mesmo padrão visual da página de Usuários (Table, Badge, Modal):
 * cabeçalho com título e contador, tabela paginada com nome, gestor,
 * total de usuários e ações. Botão "Nova Célula" visível apenas para ADMIN.
 * Modal de confirmação antes de excluir, com aviso sobre usuários sem célula.
 *
 * @component
 * @returns {JSX.Element}
 */
export default function CelulasPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isGestor } = useAuth();

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

  // -------------------------------------------------------------------------
  // Definição de colunas da tabela
  // -------------------------------------------------------------------------

  const columns = [
    {
      key: 'nome',
      header: 'Nome',
      render: (row) => (
        <span className={styles.celulaNome}>{row.nome}</span>
      ),
    },
    {
      key: 'gestor',
      header: 'Gestor',
      render: (row) => (
        row.gestor ? (
          <span className={styles.gestorInfo}>
            <span className={styles.gestorAvatar} aria-hidden="true">
              <UserCog size={16} strokeWidth={1.75} />
            </span>
            <span className={styles.gestorTexts}>
              <span className={styles.gestorNome}>{row.gestor.nome}</span>
              <span className={styles.gestorEmail}>{row.gestor.email}</span>
            </span>
          </span>
        ) : (
          <Badge label="Sem gestor" variant="warning" />
        )
      ),
    },
    {
      key: 'totalUsuarios',
      header: 'Usuários',
      align: 'center',
      width: '100px',
      render: (row) => (
        <Badge label={String(row.totalUsuarios)} variant="neutral" />
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (row) => {
        // GESTOR só pode editar a própria célula (validado também no backend).
        const isOwnCelula = row.gestor?.id === user?.id;
        const canEdit = isAdmin || (isGestor && isOwnCelula);

        return (
          <span className={styles.actions} role="group" aria-label={`Ações para ${row.nome}`}>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={Pencil}
                iconOnly
                ariaLabel={`Editar célula ${row.nome}`}
                onClick={() => navigate(ROUTES.CELULA_EDIT(row.id))}
              />
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                iconOnly
                ariaLabel={`Excluir célula ${row.nome}`}
                className={styles.deleteBtn}
                onClick={() => confirmDelete(row.id)}
              />
            )}
          </span>
        );
      },
    },
  ];

  return (
    <main className={styles.page} aria-labelledby="page-title">

      {/* ── Cabeçalho ── */}
      <header className={styles.header}>
        <div>
          <h1 id="page-title" className={styles.title}>
            <Building2 size={22} strokeWidth={1.75} className={styles.titleIcon} aria-hidden="true" />
            Células
          </h1>
          <p className={styles.subtitle} aria-live="polite">
            {isLoading ? 'Carregando…' : `${total} célula${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}
          </p>
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

      {/* ── Tabela ── */}
      <Table
        columns={columns}
        data={celulas}
        isLoading={isLoading}
        emptyMessage="Nenhuma célula cadastrada."
        ariaLabel="Lista de células"
      />

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
          <span className={styles.pageInfo} aria-current="page">
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

      {/* ── Modal de confirmação de exclusão ── */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={cancelDelete}
        title="Excluir célula"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={cancelDelete} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={executeDelete}
              isLoading={isDeleting}
              icon={Trash2}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>
          Esta ação é permanente. Os usuários vinculados a esta célula
          ficarão <strong>sem célula atribuída</strong> e precisarão ser
          realocados manualmente.
        </p>

        {deleteError && (
          <p role="alert" className={styles.modalError}>
            {deleteError}
          </p>
        )}
      </Modal>
    </main>
  );
}
