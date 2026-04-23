import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { PAGINATION } from '../core/constants/appConstants';

/** Intervalo de auto-refresh das estatísticas em milissegundos (60 segundos) */
const STATS_REFRESH_INTERVAL_MS = 60_000;

/** Estatísticas em estado inicial enquanto carregam */
const EMPTY_STATS = {
  sent: 0,
  failed: 0,
  scheduled: 0,
  pending: 0,
  totalToday: 0,
  successRate: 0,
};

/**
 * ViewModel para o Dashboard.
 *
 * - Busca stats e logs em paralelo na inicialização com `Promise.all`.
 * - Faz auto-refresh das stats a cada 60 segundos.
 * - Sincroniza filtros de log (page, limit, level) com a URL via useSearchParams.
 * - Cancela requisições de log em voo ao mudar filtros ou desmontar.
 *
 * @returns {{
 *   state: {
 *     stats: {
 *       sent: number,
 *       failed: number,
 *       scheduled: number,
 *       pending: number,
 *       totalToday: number,
 *       successRate: number
 *     },
 *     logs: import('../services/dashboardService').LogEntry[],
 *     logsTotal: number,
 *     isLoadingStats: boolean,
 *     isLoadingLogs: boolean,
 *     error: string | null,
 *     filters: { page: number, limit: number, level: string }
 *   },
 *   actions: {
 *     handleLogFilterChange: (field: string, value: string | number) => void,
 *     handleLogPageChange: (page: number) => void,
 *     refresh: () => Promise<void>
 *   }
 * }}
 */
export function useDashboardViewModel() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------- Filtros de log lidos da URL ----------
  const filters = {
    page: Number(searchParams.get('page') ?? 1),
    limit: Number(searchParams.get('limit') ?? PAGINATION.DEFAULT_LIMIT),
    level: searchParams.get('level') ?? '',
  };

  const [stats, setStats] = useState(EMPTY_STATS);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [error, setError] = useState(null);

  const logsAbortRef = useRef(null);

  // ---------- Busca de estatísticas ----------

  /**
   * Busca as estatísticas do dashboard.
   * Não cancela — é rápido e não responde a filtros variáveis.
   */
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);

    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err) {
      if (err?.details) {
        console.error('[useDashboardViewModel] Erro ao buscar stats:', err.details);
      }
      // Não sobrescreve erro de logs com erro de stats — acumula mensagem
      setError((prev) =>
        prev ? prev : err?.message ?? 'Erro ao carregar estatísticas.'
      );
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // ---------- Busca de logs ----------

  /**
   * Busca os logs de acordo com os filtros atuais.
   * Cancela requisição anterior antes de iniciar nova.
   * @param {{ page: number, limit: number, level: string }} currentFilters
   */
  const fetchLogs = useCallback(async (currentFilters) => {
    logsAbortRef.current?.abort();
    const controller = new AbortController();
    logsAbortRef.current = controller;

    setIsLoadingLogs(true);

    try {
      const result = await dashboardService.getLogs({
        page: currentFilters.page,
        limit: currentFilters.limit,
        level: currentFilters.level || undefined,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setLogs(result.data);
      setLogsTotal(result.total);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;

      if (err?.details) {
        console.error('[useDashboardViewModel] Erro ao buscar logs:', err.details);
      }
      setError((prev) =>
        prev ? prev : err?.message ?? 'Erro ao carregar logs.'
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingLogs(false);
      }
    }
  }, []);

  // ---------- Carga inicial: stats + logs em paralelo ----------
  useEffect(() => {
    setError(null);

    Promise.all([fetchStats(), fetchLogs(filters)]);

    // Auto-refresh de stats a cada STATS_REFRESH_INTERVAL_MS
    const intervalId = setInterval(() => {
      fetchStats();
    }, STATS_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      logsAbortRef.current?.abort();
    };
    // Só executa na montagem — a atualização de logs por filtro é tratada abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Re-busca logs ao mudar filtros via URL ----------
  useEffect(() => {
    setError(null);
    fetchLogs(filters);

    return () => {
      logsAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, fetchLogs]);

  // ---------- Ações ----------

  /**
   * Atualiza um filtro de log e reseta a página para 1 (exceto ao mudar `page` diretamente).
   * Persiste o novo estado na URL.
   * @param {string} field
   * @param {string | number} value
   */
  function handleLogFilterChange(field, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(field, String(value));
      if (field !== 'page') next.set('page', '1');
      return next;
    });
  }

  /**
   * Navega para uma página específica dos logs.
   * @param {number} page
   */
  function handleLogPageChange(page) {
    handleLogFilterChange('page', page);
  }

  /**
   * Força um refresh manual de stats e logs simultaneamente.
   * Útil para botão "Atualizar" na interface.
   */
  async function refresh() {
    setError(null);
    await Promise.all([fetchStats(), fetchLogs(filters)]);
  }

  return {
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
                     };
}