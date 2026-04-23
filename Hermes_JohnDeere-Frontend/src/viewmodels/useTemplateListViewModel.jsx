import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { templateService } from '../services/templateService';
import { PAGINATION } from '../core/constants/appConstants';

/**
 * ViewModel para a listagem de Templates.
 *
 * Sincroniza filtros de canal e paginação com a URL via useSearchParams.
 * Cancela requisições em andamento ao mudar filtros ou desmontar o componente.
 *
 * @returns {{
 *   state: {
 *     templates: import('../models/Template').Template[],
 *     total: number,
 *     isLoading: boolean,
 *     isDeleting: boolean,
 *     error: string | null,
 *     filters: { page: number, limit: number, channel: string }
 *   },
 *   actions: {
 *     handleFilterChange: (field: string, value: string | number) => void,
 *     handlePageChange: (page: number) => void,
 *     handleDelete: (id: string) => Promise<boolean>
 *   }
 * }}
 */
export function useTemplateListViewModel() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------- Lê filtros persistidos na URL ----------
  const filters = {
    page: Number(searchParams.get('page') ?? 1),
    limit: Number(searchParams.get('limit') ?? PAGINATION.DEFAULT_LIMIT),
    channel: searchParams.get('channel') ?? '',
  };

  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  // Ref para manter o AbortController atual sem re-renderizar
  const abortRef = useRef(null);

  // ---------- Busca a lista sempre que os filtros mudarem ----------
  const fetchTemplates = useCallback(async (currentFilters) => {
    // Cancela requisição anterior se ainda estiver em voo
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await templateService.listTemplates({
        page: currentFilters.page,
        limit: currentFilters.limit,
        channel: currentFilters.channel || undefined,
        signal: controller.signal,
      });

      // Ignora resposta de requisição cancelada
      if (controller.signal.aborted) return;

      setTemplates(result.data);
      setTotal(result.total);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;

      if (err?.details) {
        console.error('[useTemplateListViewModel] Detalhes do erro:', err.details);
      }
      setError(err?.message ?? 'Erro ao carregar templates.');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTemplates(filters);

    return () => {
      // Cancela requisição ao desmontar ou ao re-executar por mudança de filtro
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, fetchTemplates]);

  // ---------- Ações ----------

  /**
   * Atualiza um filtro e reseta a página para 1 (exceto ao alterar `page` diretamente).
   * Persiste o novo estado na URL.
   * @param {string} field
   * @param {string | number} value
   */
  function handleFilterChange(field, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(field, String(value));
      // Ao mudar qualquer filtro que não seja a própria página, voltar ao início
      if (field !== 'page') next.set('page', '1');
      return next;
    });
  }

  /**
   * Navega para uma página específica da listagem.
   * @param {number} page
   */
  function handlePageChange(page) {
    handleFilterChange('page', page);
  }

  /**
   * Deleta um template pelo ID após confirmação prévia (a confirmação é responsabilidade da View).
   * @param {string} id
   * @returns {Promise<boolean>} `true` em sucesso, `false` em falha
   */
  async function handleDelete(id) {
    setIsDeleting(true);
    setError(null);

    try {
      await templateService.deleteTemplate(id);

      // Atualiza a lista local otimisticamente
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));

      return true;
    } catch (err) {
      if (err?.details) {
        console.error('[useTemplateListViewModel] Detalhes do erro ao deletar:', err.details);
      }
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