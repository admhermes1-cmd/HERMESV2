/**
 * @fileoverview useCelulaListViewModel.js
 * @module viewmodels/useCelulaListViewModel
 *
 * ViewModel para a tela de listagem de células (CelulasPage).
 * Gerencia paginação, exclusão com modal de confirmação e sincronização
 * de filtros via URL (useSearchParams).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { celulaService } from '../services/celulaService';
import { PAGINATION }    from '../core/constants/appConstants';

/**
 * @typedef {Object} CelulaListState
 * @property {CelulaResponseDTO[]} celulas        - Lista de células da página atual.
 * @property {number}              total          - Total de células no banco.
 * @property {number}              page           - Página atual (1-based).
 * @property {number}              limit          - Itens por página.
 * @property {boolean}             isLoading      - Carregamento em andamento.
 * @property {string|null}         error          - Mensagem de erro da listagem.
 * @property {string|null}         deleteTarget   - UUID da célula selecionada para exclusão.
 * @property {boolean}             isDeleting     - Exclusão em andamento.
 * @property {string|null}         deleteError    - Erro durante a exclusão.
 * @property {string|null}         successBanner  - Mensagem de sucesso temporária.
 * @property {Function}            setPage        - Navega para uma página.
 * @property {Function}            confirmDelete  - Abre modal de confirmação passando o id.
 * @property {Function}            cancelDelete   - Fecha o modal sem excluir.
 * @property {Function}            executeDelete  - Executa a exclusão confirmada.
 * @property {Function}            refresh        - Força recarregamento da lista.
 */

/**
 * ViewModel de listagem de células.
 *
 * @returns {CelulaListState}
 */
export function useCelulaListViewModel() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page  = Math.max(1, Number(searchParams.get('page')  ?? 1));
  const limit = Number(searchParams.get('limit') ?? PAGINATION.DEFAULT_PAGE_SIZE);

  const [celulas,       setCelulas]       = useState([]);
  const [total,         setTotal]         = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [deleteError,   setDeleteError]   = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  const abortRef    = useRef(null);
  const bannerTimer = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchCelulas = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const data = await celulaService.listCelulas(
        { page, limit },
        abortRef.current.signal,
      );
      setCelulas(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setError(err.message ?? 'Erro ao carregar células.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchCelulas();
    return () => abortRef.current?.abort();
  }, [fetchCelulas]);

  // ── Paginação ─────────────────────────────────────────────────────────────

  const setPage = useCallback((nextPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(nextPage));
      return next;
    });
  }, [setSearchParams]);

  // ── Exclusão ──────────────────────────────────────────────────────────────

  const confirmDelete = useCallback((id) => {
    setDeleteTarget(id);
    setDeleteError(null);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError(null);
  }, []);

  const executeDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await celulaService.deleteCelula(deleteTarget);
      setDeleteTarget(null);

      // Exibe banner de sucesso por 4s
      clearTimeout(bannerTimer.current);
      setSuccessBanner('Célula excluída com sucesso.');
      bannerTimer.current = setTimeout(() => setSuccessBanner(null), 4_000);

      // Se era a última da página, volta uma
      const isLastOnPage = celulas.length === 1 && page > 1;
      if (isLastOnPage) {
        setPage(page - 1);
      } else {
        fetchCelulas();
      }
    } catch (err) {
      setDeleteError(err.message ?? 'Erro ao excluir célula.');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, celulas.length, page, setPage, fetchCelulas]);

  const refresh = useCallback(() => fetchCelulas(), [fetchCelulas]);

  // Limpa timer ao desmontar
  useEffect(() => () => {
    clearTimeout(bannerTimer.current);
    abortRef.current?.abort();
  }, []);

  return {
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
    refresh,
  };
}
