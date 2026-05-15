import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { templateService } from '../services/templateService';
import { PAGINATION } from '../core/constants/appConstants';

/**
 * ViewModel para a listagem de Templates.
 *
 * Retorno FLAT: a TemplatesPage desestrutura todos os campos diretamente.
 * Sincroniza filtros com URL via useSearchParams.
 * Cancela requisições em voo ao mudar filtros ou desmontar.
 *
 * @returns {{
 *   templates: object[],
 *   total: number,
 *   isLoading: boolean,
 *   isDeleting: boolean,
 *   error: string | null,
 *   filters: { page: number, limit: number, channel: string },
 *   handleFilterChange: (field: string, value: string | number | null) => void,
 *   handlePageChange: (page: number) => void,
 *   handleDelete: (id: string) => Promise<boolean>
 * }}
 */
export function useTemplateListViewModel() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {
    page:    Number(searchParams.get('page')  ?? 1),
    limit:   Number(searchParams.get('limit') ?? PAGINATION.DEFAULT_PAGE_SIZE),
    channel: searchParams.get('channel') ?? '',
  };

  const [templates, setTemplates]   = useState([]);
  const [total, setTotal]           = useState(0);
  const [isLoading, setIsLoading]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError]           = useState(null);

  const abortRef = useRef(null);

  const fetchTemplates = useCallback(async (currentFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await templateService.listTemplates({
        page:    currentFilters.page,
        limit:   currentFilters.limit,
        channel: currentFilters.channel || undefined,
        signal:  controller.signal,
      });

      if (controller.signal.aborted) return;

      setTemplates(result.data);
      setTotal(result.total);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (err?.details) console.error('[useTemplateListViewModel] erro:', err.details);
      setError(err?.message ?? 'Erro ao carregar templates.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates(filters);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, fetchTemplates]);

  /**
   * Atualiza filtro na URL. Reseta page para 1 exceto quando o campo é 'page'.
   * Aceita null para limpar o filtro.
   */
  function handleFilterChange(field, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null || value === '') {
        next.delete(field);
      } else {
        next.set(field, String(value));
      }
      if (field !== 'page') next.set('page', '1');
      return next;
    });
  }

  function handlePageChange(page) {
    handleFilterChange('page', page);
  }

  /**
   * Deleta um template. A confirmação de UI é responsabilidade da View.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async function handleDelete(id) {
    setIsDeleting(true);
    setError(null);

    try {
      await templateService.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      return true;
    } catch (err) {
      if (err?.details) console.error('[useTemplateListViewModel] erro ao deletar:', err.details);
      setError(err?.message ?? 'Erro ao deletar template.');
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    templates,
    total,
    isLoading,
    isDeleting,
    error,
    filters,
    handleFilterChange,
    handlePageChange,
    handleDelete,
  };
}