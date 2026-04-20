/**
 * @file TemplatesPage.jsx
 * @description Página de listagem e gerenciamento de templates de notificação.
 *
 * Responsabilidades desta View:
 * - Renderizar a lista de templates com filtros e paginação
 * - Exibir controles de CRUD restritos a usuários ADMIN
 * - Gerenciar estado de UI local: modal de exclusão e banner de sucesso/erro
 * - Toda lógica de negócio é delegada ao `useTemplateListViewModel`
 *
 * @dependencies
 * - useTemplateListViewModel — estado e ações da listagem de templates
 * - useAuth — contexto de autenticação (isAdmin)
 * - useNavigate — navegação programática (react-router-dom)
 * - Table, Badge, Button, Modal, LoadingSpinner — componentes comuns
 * - formatDate, formatChannel — utilitários de formatação
 * - appConstants (ROUTES, PAGINATION, UI) — constantes da aplicação
 * - lucide-react — ícones
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useAuth } from '../../core/auth/Useauth';
import { useTemplateListViewModel } from '../../viewmodels/useTemplateListViewModel';
import { ROUTES, PAGINATION, UI } from '../../core/constants/AppConstants';
import { TemplateChannel } from '../../models/Template';

import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';

import { formatDate } from '../../utils/Formatters';

import styles from './TemplatesPage.module.css';

// ---------------------------------------------------------------------------
// Mapeamento de canal → variante de Badge
// ---------------------------------------------------------------------------
const CHANNEL_BADGE_VARIANT = {
  [TemplateChannel.EMAIL]:    'info',
  [TemplateChannel.SMS]:      'warning',
  [TemplateChannel.WHATSAPP]: 'success',
};

// ---------------------------------------------------------------------------
// TemplatesPage
// ---------------------------------------------------------------------------
/**
 * Página principal de gerenciamento de templates.
 * Renderiza filtros, tabela paginada e modal de confirmação de exclusão.
 */
export default function TemplatesPage() {
  const navigate  = useNavigate();
  const { isAdmin } = useAuth();

  const {
    templates,
    total,
    isLoading,
    isDeleting,
    error,
    filters,
    handleFilterChange,
    handlePageChange,
    handleDelete,
  } = useTemplateListViewModel();

  // ── Estado local de UI ──────────────────────────────────────────────────
  /** Template alvo da exclusão; null quando nenhum modal está aberto */
  const [deleteTarget, setDeleteTarget] = useState(null);
  /** Controla exibição do banner de sucesso após exclusão */
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Auto-dismiss do banner de sucesso ───────────────────────────────────
  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  // ── Paginação ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const currentPage = filters.page;

  // ── Handlers de UI ───────────────────────────────────────────────────────
  const handleDeleteClick = useCallback((template) => {
    setDeleteTarget({ id: template.id, name: template.name });
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const success = await handleDelete(deleteTarget.id);
    if (success) {
      setDeleteTarget(null);
      setShowSuccess(true);
    }
  }, [deleteTarget, handleDelete]);

  // ── Colunas da tabela ────────────────────────────────────────────────────
  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row) => (
        <span className={styles.nameCell}>
          <FileText size={15} className={styles.nameCellIcon} aria-hidden="true" />
          {row.name}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Canal',
      render: (row) => (
        <Badge
          label={UI.CHANNEL_LABELS[row.channel] ?? row.channel}
          variant={CHANNEL_BADGE_VARIANT[row.channel] ?? 'neutral'}
        />
      ),
    },
    {
      key: 'versions',
      header: 'Versões',
      render: (row) => (
        <span className={styles.versionsCell}>
          {Array.isArray(row.versions) ? row.versions.length : (row.versionCount ?? '—')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (row) => (
        <span className={styles.dateCell}>{formatDate(row.createdAt)}</span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <span className={styles.actionsCell}>
                <button
                  className={`${styles.iconBtn} ${styles.iconBtnEdit}`}
                  onClick={() => navigate(ROUTES.TEMPLATE_EDIT(row.id))}
                  aria-label={`Editar template ${row.name}`}
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.iconBtnDelete}`}
                  onClick={() => handleDeleteClick(row)}
                  aria-label={`Excluir template ${row.name}`}
                  title="Excluir"
                >
                  <Trash2 size={15} />
                </button>
              </span>
            ),
          },
        ]
      : []),
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Banner de erro ──────────────────────────────────────────────── */}
      {error && (
        <div className={styles.bannerError} role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Banner de sucesso ────────────────────────────────────────────── */}
      <div
        className={`${styles.bannerSuccess} ${showSuccess ? styles.bannerSuccessVisible : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <CheckCircle2 size={16} aria-hidden="true" />
        <span>Template excluído com sucesso.</span>
      </div>

      {/* ── Header da página ─────────────────────────────────────────────── */}
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <h1 className={styles.pageTitle}>Templates</h1>
          <p
            className={styles.pageSubtitle}
            aria-live="polite"
            aria-atomic="true"
          >
            {isLoading
              ? 'Carregando…'
              : `${total} ${total === 1 ? 'template encontrado' : 'templates encontrados'}`}
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            onClick={() => navigate(ROUTES.TEMPLATE_NEW)}
            aria-label="Criar novo template"
          >
            <Plus size={16} aria-hidden="true" />
            Novo Template
          </Button>
        )}
      </header>

      {/* ── Barra de filtros ─────────────────────────────────────────────── */}
      <div className={styles.filterBar} role="search" aria-label="Filtros de templates">
        <span className={styles.filterIcon} aria-hidden="true">
          <Filter size={15} />
        </span>

        <label htmlFor="channelFilter" className={styles.filterLabel}>
          Canal
        </label>
        <select
          id="channelFilter"
          className={styles.filterSelect}
          value={filters.channel ?? ''}
          onChange={(e) => handleFilterChange('channel', e.target.value || null)}
          aria-label="Filtrar por canal"
        >
          <option value="">Todos</option>
          <option value={TemplateChannel.EMAIL}>E-mail</option>
          <option value={TemplateChannel.SMS}>SMS</option>
          <option value={TemplateChannel.WHATSAPP}>WhatsApp</option>
        </select>
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      <div className={styles.tableWrapper}>
        <Table
          columns={columns}
          data={templates}
          isLoading={isLoading}
          emptyMessage="Nenhum template encontrado."
        />
      </div>

      {/* ── Paginação ────────────────────────────────────────────────────── */}
      {!isLoading && total > 0 && (
        <nav className={styles.pagination} aria-label="Paginação de templates">
          <button
            className={styles.pageBtn}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
            Anterior
          </button>

          <span className={styles.pageIndicator} aria-current="page">
            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
          </span>

          <button
            className={styles.pageBtn}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Próxima página"
          >
            Próximo
            <ChevronRight size={16} />
          </button>

          <label htmlFor="limitSelect" className={styles.limitLabel}>
            Itens por página:
          </label>
          <select
            id="limitSelect"
            className={styles.limitSelect}
            value={filters.limit}
            onChange={(e) => {
              handleFilterChange('limit', Number(e.target.value));
              handlePageChange(1);
            }}
            aria-label="Itens por página"
          >
            {PAGINATION.LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </nav>
      )}

      {/* ── Modal de confirmação de exclusão ─────────────────────────────── */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={handleDeleteCancel}
        title="Confirmar exclusão"
        footer={
          <>
            <Button variant="ghost" onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={handleDeleteConfirm}
              aria-label={`Confirmar exclusão do template ${deleteTarget?.name ?? ''}`}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className={styles.modalBody}>
          Tem certeza que deseja excluir o template{' '}
          <strong className={styles.modalTemplateName}>{deleteTarget?.name}</strong>?
          <br />
          <span className={styles.modalWarning}>Esta ação não pode ser desfeita.</span>
        </p>
      </Modal>
    </div>
  );
}