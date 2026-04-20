/**
 * @file DashboardPage.jsx
 * @description Página principal do sistema HERMES. Exibe métricas em tempo real de notificações
 * enviadas, falhas, agendamentos e pendências, além de logs do sistema com filtros e paginação.
 *
 * Auto-refresh: o ViewModel atualiza as stats automaticamente a cada 60 segundos via setInterval.
 * O componente rastreia o timestamp do último refresh para exibir "Atualizado às HH:MM".
 *
 * Dependências:
 * - useDashboardViewModel: toda a lógica de negócio, fetch, filtros e paginação
 * - useNavigate: redirecionamento para Nova Notificação e Templates
 * - useAuth: dados do usuário autenticado
 * - Table, Badge, Button, LoadingSpinner: componentes comuns do projeto
 * - formatDate: utilitário de formatação de datas
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  BarChart2,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { useDashboardViewModel } from '../../viewmodels/useDashboardViewModel';
import { useAuth } from '../../core/auth/useAuth';
import { ROUTES } from '../../core/constants/Appconstants';
import Table from '../components/common/Table';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { formatDate } from '../../utils/formatters';

import styles from './DashboardPage.module.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna a variante de cor para o anel SVG de taxa de sucesso.
 * @param {number} rate - Percentual de 0 a 100
 * @returns {'success'|'warning'|'error'}
 */
function successRateVariant(rate) {
  if (rate >= 90) return 'success';
  if (rate >= 70) return 'warning';
  return 'error';
}

/**
 * Converte um percentual em stroke-dashoffset para o anel SVG.
 * Circunferência = 2π × r, onde r = 44.
 * @param {number} rate - Percentual de 0 a 100
 * @returns {number}
 */
function rateToOffset(rate) {
  const CIRCUMFERENCE = 2 * Math.PI * 44;
  return CIRCUMFERENCE - (rate / 100) * CIRCUMFERENCE;
}

/**
 * Mapeia o nível de log para a variante do Badge.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @returns {string}
 */
function logLevelVariant(level) {
  const map = { INFO: 'info', WARN: 'warning', ERROR: 'error' };
  return map[level] ?? 'info';
}

/**
 * Mapeia o nível de log para o label exibido no Badge.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @returns {string}
 */
function logLevelLabel(level) {
  const map = { INFO: 'INFO', WARN: 'AVISO', ERROR: 'ERRO' };
  return map[level] ?? level;
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Skeleton shimmer para um único card de métrica */
function MetricCardSkeleton() {
  return (
    <div className={styles.metricCard} aria-hidden="true">
      <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
      <div className={styles.skeletonContent}>
        <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
        <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
      </div>
    </div>
  );
}

/**
 * Card de métrica individual.
 * @param {{ icon: React.ReactNode, label: string, value: number, colorClass: string, highlight?: boolean }} props
 */
function MetricCard({ icon, label, value, colorClass, highlight }) {
  return (
    <div
      className={`${styles.metricCard} ${colorClass} ${highlight ? styles.metricCardHighlight : ''}`}
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <div className={`${styles.metricIcon} ${colorClass}`}>{icon}</div>
      <div className={styles.metricBody}>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricValue}>{value.toLocaleString('pt-BR')}</span>
        <span className={styles.metricDelta}>—</span>
      </div>
    </div>
  );
}

/**
 * Anel SVG de progresso circular para exibir a taxa de sucesso.
 * @param {{ rate: number }} props
 */
function SuccessRateRing({ rate }) {
  const CIRCUMFERENCE = 2 * Math.PI * 44;
  const offset = rateToOffset(rate);
  const variant = successRateVariant(rate);
  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };
  const color = colorMap[variant];

  return (
    <div className={styles.ringWrapper} aria-label={`Taxa de sucesso: ${rate}%`}>
      <svg
        className={styles.ringSvg}
        viewBox="0 0 100 100"
        width="120"
        height="120"
        aria-hidden="true"
      >
        {/* Trilha */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="8"
        />
        {/* Arco de progresso */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className={styles.ringCenter} style={{ color }}>
        <span className={styles.ringPercent}>{rate.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * @component DashboardPage
 * @description Página inicial da aplicação autenticada. Exibe métricas do sistema,
 * taxa de sucesso em tempo real e logs com filtros por nível e paginação.
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    stats,
    isLoadingStats,
    logs,
    logsTotal,
    isLoadingLogs,
    error,
    filters,
    handleLogFilterChange,
    handleLogPageChange,
    refresh,
  } = useDashboardViewModel();

  /** Timestamp do último refresh bem-sucedido */
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Atualiza lastRefreshed sempre que isLoadingStats passa de true → false
  useEffect(() => {
    if (!isLoadingStats) {
      setLastRefreshed(new Date());
    }
  }, [isLoadingStats]);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(logsTotal / filters.limit));
  const canPrev = filters.page > 1;
  const canNext = filters.page < totalPages;

  // Colunas da tabela de logs
  const logColumns = [
    {
      key: 'level',
      header: 'Nível',
      render: (row) => (
        <Badge label={logLevelLabel(row.level)} variant={logLevelVariant(row.level)} />
      ),
    },
    {
      key: 'message',
      header: 'Mensagem',
      render: (row) => (
        <span className={styles.logMessage} title={row.message}>
          {row.message}
        </span>
      ),
    },
    {
      key: 'context',
      header: 'Contexto',
      render: (row) => <span className={styles.logContext}>{row.context}</span>,
    },
    {
      key: 'createdAt',
      header: 'Data/Hora',
      render: (row) => formatDate(row.createdAt),
    },
  ];

  // Enriquece as linhas de log para destacar ERRORs
  const enrichedLogs = logs.map((log) => ({
    ...log,
    _rowClassName: log.level === 'ERROR' ? styles.logRowError : undefined,
  }));

  return (
    <main className={styles.page}>
      {/* ------------------------------------------------------------------ */}
      {/* Banner de erro global                                               */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTitle}>
          <div className={styles.titleRow}>
            <Zap size={22} className={styles.titleIcon} aria-hidden="true" />
            <h1 className={styles.title}>Dashboard</h1>
          </div>
          <p className={styles.subtitle}>Visão geral do sistema de notificações</p>
          <div className={styles.refreshIndicator} aria-live="polite">
            <RefreshCw
              size={13}
              className={`${styles.refreshIcon} ${isLoadingStats ? styles.spinning : ''}`}
              aria-hidden="true"
            />
            <span className={styles.refreshText}>
              {isLoadingStats
                ? 'Atualizando…'
                : lastRefreshed
                ? `Atualizado às ${lastRefreshed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Aguardando dados'}
            </span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            onClick={handleRefresh}
            isLoading={isLoadingStats}
            aria-label="Atualizar dados do dashboard"
            title="Atualizar"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Atualizar
          </Button>
          <Button variant="secondary" onClick={() => navigate(ROUTES.TEMPLATES)}>
            <FileText size={15} aria-hidden="true" />
            Templates
          </Button>
          <Button variant="primary" onClick={() => navigate(ROUTES.NOTIFICATION_NEW)}>
            <Send size={15} aria-hidden="true" />
            Nova Notificação
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Grid de métricas                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section
        className={styles.metricsSection}
        aria-live="polite"
        aria-label="Métricas de notificações"
      >
        {isLoadingStats ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              icon={<CheckCircle2 size={28} />}
              label="Enviados Hoje"
              value={stats.sent}
              colorClass={styles.colorSuccess}
            />
            <MetricCard
              icon={<XCircle size={28} />}
              label="Falhas"
              value={stats.failed}
              colorClass={styles.colorError}
              highlight={stats.failed > 0}
            />
            <MetricCard
              icon={<Clock size={28} />}
              label="Agendados"
              value={stats.scheduled}
              colorClass={styles.colorInfo}
            />
            <MetricCard
              icon={<AlertTriangle size={28} />}
              label="Pendentes"
              value={stats.pending}
              colorClass={styles.colorWarning}
            />
          </>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Taxa de sucesso + Total do dia                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className={styles.rateSection} aria-label="Taxa de sucesso e total do dia">
        <div className={styles.rateCard}>
          <div className={styles.rateCardHeader}>
            <TrendingUp size={18} aria-hidden="true" />
            <h2 className={styles.sectionTitle}>Taxa de Sucesso</h2>
          </div>
          {isLoadingStats ? (
            <div className={`${styles.skeleton} ${styles.skeletonRing}`} />
          ) : (
            <>
              <SuccessRateRing rate={stats.successRate} />
              <p className={styles.rateLabel}>Taxa de sucesso hoje</p>
            </>
          )}
        </div>

        <div className={styles.totalCard}>
          <div className={styles.totalCardHeader}>
            <BarChart2 size={18} aria-hidden="true" />
            <h2 className={styles.sectionTitle}>Total do Dia</h2>
          </div>
          {isLoadingStats ? (
            <div className={`${styles.skeleton} ${styles.skeletonTotalValue}`} />
          ) : (
            <>
              <span className={styles.totalValue}>{stats.totalToday.toLocaleString('pt-BR')}</span>
              <p className={styles.totalLabel}>comunicações processadas hoje</p>
            </>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Seção de logs                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className={styles.logsSection} aria-label="Logs do sistema">
        <div className={styles.logsHeader}>
          <div className={styles.logsTitleGroup}>
            <BarChart2 size={18} aria-hidden="true" />
            <h2 className={styles.sectionTitle}>Logs do Sistema</h2>
            {logsTotal > 0 && (
              <span className={styles.logsBadge}>{logsTotal.toLocaleString('pt-BR')}</span>
            )}
          </div>
          <div className={styles.logsFilter}>
            <label htmlFor="log-level-filter" className={styles.filterLabel}>
              Nível:
            </label>
            <select
              id="log-level-filter"
              className={styles.filterSelect}
              value={filters.level ?? ''}
              onChange={(e) => handleLogFilterChange('level', e.target.value || undefined)}
              aria-label="Filtrar logs por nível"
            >
              <option value="">Todos</option>
              <option value="INFO">INFO</option>
              <option value="WARN">AVISO</option>
              <option value="ERROR">ERRO</option>
            </select>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <Table
            columns={logColumns}
            data={enrichedLogs}
            isLoading={isLoadingLogs}
            emptyMessage="Nenhum log encontrado para os filtros selecionados."
          />
        </div>

        {/* Paginação */}
        {!isLoadingLogs && logsTotal > 0 && (
          <div className={styles.pagination} role="navigation" aria-label="Paginação de logs">
            <button
              className={styles.paginationBtn}
              onClick={() => handleLogPageChange(filters.page - 1)}
              disabled={!canPrev}
              aria-label="Página anterior"
            >
              ← Anterior
            </button>
            <span className={styles.paginationInfo}>
              Página <strong>{filters.page}</strong> de <strong>{totalPages}</strong>
            </span>
            <button
              className={styles.paginationBtn}
              onClick={() => handleLogPageChange(filters.page + 1)}
              disabled={!canNext}
              aria-label="Próxima página"
            >
              Próxima →
            </button>
          </div>
        )}
      </section>
    </main>
  );
}