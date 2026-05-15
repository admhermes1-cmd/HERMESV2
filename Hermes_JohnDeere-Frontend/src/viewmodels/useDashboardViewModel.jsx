import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { PAGINATION } from '../core/constants/appConstants';

const STATS_REFRESH_INTERVAL_MS = 60_000;

const EMPTY_STATS = {
  sent: 0, failed: 0, scheduled: 0, pending: 0, totalToday: 0, successRate: 0,
};

/**
 * ViewModel para o Dashboard.
 *
 * Retorno FLAT: a DashboardPage desestrutura todos os campos diretamente.
 * Stats com auto-refresh a cada 60s. Filtros de log sincronizados com URL.
 * Cancela requisições de log ao mudar filtros ou desmontar.
 *
 * @returns {{
 *   stats: { sent: number, failed: number, scheduled: number, pending: number, totalToday: number, successRate: number },
 *   logs: object[],
 *   logsTotal: number,
 *   isLoadingStats: boolean,
 *   isLoadingLogs: boolean,
 *   error: string | null,
 *   filters: { page: number, limit: number, level: string },
 *   handleLogFilterChange: (field: string, value: string | number | undefined) => void,
 *   handleLogPageChange: (page: number) => void,
 *   refresh: () => Promise<void>
 * }}
 */
export function useDashboardViewModel() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {
    page:  Number(searchParams.get('page')  ?? 1),
    limit: Number(searchParams.get('limit') ?? PAGINATION.DEFAULT_PAGE_SIZE),
    level: searchParams.get('level') ?? '',
  };

  const [stats, setStats]               = useState(EMPTY_STATS);
  const [logs, setLogs]                 = useState([]);
  const [logsTotal, setLogsTotal]       = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs]   = useState(true);
  const [error, setError]               = useState(null);

  const logsAbortRef = useRef(null);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err) {
      if (err?.details) console.error('[useDashboardViewModel] erro stats:', err.details);
      setError((prev) => prev ?? err?.message ?? 'Erro ao carregar estatísticas.');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  const fetchLogs = useCallback(async (currentFilters) => {
    logsAbortRef.current?.abort();
    const controller = new AbortController();
    logsAbortRef.current = controller;

    setIsLoadingLogs(true);

    try {
      const result = await dashboardService.getLogs({
        page:   currentFilters.page,
        limit:  currentFilters.limit,
        level:  currentFilters.level || undefined,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setLogs(result.data);
      setLogsTotal(result.total);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (err?.details) console.error('[useDashboardViewModel] erro logs:', err.details);
      setError((prev) => prev ?? err?.message ?? 'Erro ao carregar logs.');
    } finally {
      if (!controller.signal.aborted) setIsLoadingLogs(false);
    }
  }, []);

  // Carga inicial: stats + logs em paralelo + auto-refresh
  useEffect(() => {
    setError(null);
    Promise.all([fetchStats(), fetchLogs(filters)]);

    const intervalId = setInterval(() => fetchStats(), STATS_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      logsAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-busca logs ao mudar filtros via URL
  useEffect(() => {
    setError(null);
    fetchLogs(filters);

    return () => logsAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, fetchLogs]);

  function handleLogFilterChange(field, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === undefined || value === '') {
        next.delete(field);
      } else {
        next.set(field, String(value));
      }
      if (field !== 'page') next.set('page', '1');
      return next;
    });
  }

  function handleLogPageChange(page) {
    handleLogFilterChange('page', page);
  }

  async function refresh() {
    setError(null);
    await Promise.all([fetchStats(), fetchLogs(filters)]);
  }

  return {
    stats,
    logs,
    logsTotal,
    isLoadingStats,
    isLoadingLogs,
    error,
    filters,
    handleLogFilterChange,
    handleLogPageChange,
    refresh,
  };
}