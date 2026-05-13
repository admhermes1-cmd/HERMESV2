import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, RefreshCw, Trash2, Pencil, KeyRound, Upload } from 'lucide-react';
import { useUserListViewModel } from '../../viewmodels/useUserListViewModel';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Table from '../components/common/Table';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import UserImportModal from '../components/UserImportModal';
import { ROUTES } from '../../core/constants/appConstants';
import { formatDate } from '../../utils/Formatters';
import styles from './UsersPage.module.css';

/**
 * Página de listagem de usuários — acessível apenas por administradores.
 *
 * <p>Exibe uma tabela paginada com filtros por papel e status, além de ações
 * inline para editar, redefinir senha e excluir cada usuário. As ações
 * destrutivas (exclusão, reset de senha) são protegidas por modal de
 * confirmação.</p>
 *
 * @component
 * @returns {JSX.Element}
 */
export default function UsersPage() {
  const navigate = useNavigate();

  const {
    users,
    isLoading,
    error,
    totalPages,
    totalItems,
    currentPage,
    roleFilter,
    activeFilter,
    deleteTarget,
    resetTarget,
    isDeleting,
    isResetting,
    handlePageChange,
    handleRoleFilter,
    handleActiveFilter,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleResetRequest,
    handleResetConfirm,
    handleResetCancel,
  } = useUserListViewModel();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  /**
   * Chamado pelo modal após importação com ao menos 1 sucesso.
   * Redireciona para a listagem de usuários para exibir os novos registros.
   */
  const handleImportSuccess = () => {
    navigate('/users');
  };

  // -------------------------------------------------------------------------
  // Definição de colunas da tabela
  // -------------------------------------------------------------------------

  const columns = [
    {
      key:    'name',
      label:  'Nome',
      render: (row) => (
        <span className={styles.nameCell}>
          <span className={styles.nameText}>{row.name}</span>
          <span className={styles.emailText}>{row.email}</span>
        </span>
      ),
    },
    {
      key:    'role',
      label:  'Papel',
      render: (row) => (
        <Badge
          label={row.role}
          variant={row.role === 'ADMIN' ? 'success' : 'info'}
        />
      ),
    },
    {
      key:    'isActive',
      label:  'Status',
      render: (row) => (
        <Badge
          label={row.isActive ? 'Ativo' : 'Inativo'}
          variant={row.isActive ? 'success' : 'neutral'}
        />
      ),
    },
    {
      key:    'createdAt',
      label:  'Criado em',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key:    'actions',
      label:  'Ações',
      render: (row) => (
        <span className={styles.actions} role="group" aria-label={`Ações para ${row.name}`}>
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            iconOnly
            aria-label={`Editar ${row.name}`}
            onClick={() => navigate(ROUTES.USER_EDIT(row.id))}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={KeyRound}
            iconOnly
            aria-label={`Redefinir senha de ${row.name}`}
            onClick={() => handleResetRequest(row.id)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            iconOnly
            aria-label={`Excluir ${row.name}`}
            className={styles.deleteBtn}
            onClick={() => handleDeleteRequest(row.id)}
          />
        </span>
      ),
    },
  ];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main className={styles.page} aria-labelledby="page-title">
      {/* Cabeçalho */}
      <header className={styles.header}>
        <div>
          <h1 id="page-title" className={styles.title}>Usuários</h1>
          <p className={styles.subtitle} aria-live="polite">
            {isLoading ? 'Carregando…' : `${totalItems} usuário${totalItems !== 1 ? 's' : ''} encontrado${totalItems !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            onClick={() => setIsImportModalOpen(true)}
            icon={<Upload size={15} />}
            aria-label="Importar usuários em massa via CSV ou JSON"
          >
            Importar em Massa
          </Button>

          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => navigate(ROUTES.USER_NEW)}
          >
            Novo usuário
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <section className={styles.filters} aria-label="Filtros de listagem">
        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Papel</span>
          <select
            className={styles.select}
            value={roleFilter}
            onChange={(e) => handleRoleFilter(e.target.value)}
            aria-label="Filtrar por papel"
          >
            <option value="">Todos</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">Usuário</option>
          </select>
        </label>

        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status</span>
          <select
            className={styles.select}
            value={activeFilter}
            onChange={(e) => handleActiveFilter(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="">Todos</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </label>

        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={() => { handleRoleFilter(''); handleActiveFilter(''); }}
          aria-label="Limpar filtros"
        >
          Limpar filtros
        </Button>
      </section>

      {/* Erro global */}
      {error && (
        <div role="alert" aria-live="assertive" className={styles.errorBanner}>
          {error}
        </div>
      )}

      {/* Tabela */}
      <Table
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="Nenhum usuário encontrado para os filtros selecionados."
      />

      {/* Paginação */}
      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Paginação">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => handlePageChange(currentPage - 1)}
            aria-label="Página anterior"
          >
            Anterior
          </Button>

          <span className={styles.pageInfo} aria-current="page">
            Página {currentPage + 1} de {totalPages}
          </span>

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => handlePageChange(currentPage + 1)}
            aria-label="Próxima página"
          >
            Próxima
          </Button>
        </nav>
      )}

      {/* Modal — Confirmação de exclusão */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={handleDeleteCancel}
        title="Excluir usuário"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
              icon={Trash2}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p>Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.</p>
      </Modal>

      {/* Modal — Confirmação de reset de senha */}
      <Modal
        isOpen={Boolean(resetTarget)}
        onClose={handleResetCancel}
        title="Redefinir senha"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={handleResetCancel} disabled={isResetting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleResetConfirm}
              isLoading={isResetting}
              icon={KeyRound}
            >
              Redefinir
            </Button>
          </>
        }
      >
        <p>
          Uma nova senha será gerada automaticamente e enviada por e-mail ao usuário.
          Deseja continuar?
        </p>
      </Modal>

      <UserImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </main>
  );
}