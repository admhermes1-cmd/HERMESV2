import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { userService } from '../services/userService';
import { ROUTES, PAGINATION } from '../core/constants/appConstants';

/**
 * @typedef {Object} UserListState
 * @property {import('../core/models/User').UserSummary[]} users        - Página atual de usuários.
 * @property {boolean}                                     isLoading    - Indica carregamento em andamento.
 * @property {string|null}                                 error        - Mensagem de erro amigável, ou null.
 * @property {number}                                      totalPages   - Total de páginas disponíveis.
 * @property {number}                                      totalItems   - Total de itens no servidor.
 * @property {number}                                      currentPage  - Índice da página atual (0-based).
 * @property {string}                                      roleFilter   - Valor do filtro de papel selecionado.
 * @property {string}                                      activeFilter - Valor do filtro de status selecionado.
 * @property {string|null}                                 deleteTarget - ID do usuário pendente de exclusão.
 * @property {string|null}                                 resetTarget  - ID do usuário pendente de reset de senha.
 * @property {boolean}                                     isDeleting   - Indica exclusão em andamento.
 * @property {boolean}                                     isResetting  - Indica reset em andamento.
 * @property {Function}                                    handlePageChange      - Navega para uma página.
 * @property {Function}                                    handleRoleFilter      - Aplica filtro de papel.
 * @property {Function}                                    handleActiveFilter    - Aplica filtro de status.
 * @property {Function}                                    handleDeleteRequest   - Abre modal de confirmação de exclusão.
 * @property {Function}                                    handleDeleteConfirm   - Confirma e executa a exclusão.
 * @property {Function}                                    handleDeleteCancel    - Cancela a exclusão.
 * @property {Function}                                    handleResetRequest    - Abre modal de confirmação de reset.
 * @property {Function}                                    handleResetConfirm    - Confirma e executa o reset.
 * @property {Function}                                    handleResetCancel     - Cancela o reset.
 */

/**
 * ViewModel para a página de listagem de usuários.
 *
 * <p>Sincroniza filtros (role, isActive) e paginação com a URL via {@link useSearchParams},
 * garantindo que links diretos e o botão Voltar do navegador funcionem corretamente.</p>
 *
 * <p>Gerencia os modais de confirmação para exclusão e reset de senha sem expor
 * lógica de negócio à camada de View.</p>
 *
 * @returns {UserListState} Estado e ações para a tela de listagem de usuários.
 */
export function useUserListViewModel() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage  = parseInt(searchParams.get('page')   ?? '0', 10);
  const roleFilter   = searchParams.get('role')             ?? '';
  const activeFilter = searchParams.get('isActive')         ?? '';

  const [users,       setUsers]       = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState(null);
  const [totalPages,  setTotalPages]  = useState(0);
  const [totalItems,  setTotalItems]  = useState(0);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget,  setResetTarget]  = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [isResetting,  setIsResetting]  = useState(false);

  const abortRef = useRef(null);

  // -------------------------------------------------------------------------
  // Busca de dados
  // -------------------------------------------------------------------------

  const fetchUsers = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const params = {
        page:  currentPage + 1,
        limit: PAGINATION.DEFAULT_PAGE_SIZE,
      };
      if (roleFilter)   params.role     = roleFilter;
      if (activeFilter !== '') params.isActive = activeFilter;

      const data = await userService.listUsers(params, abortRef.current.signal);
      setUsers(data.data ?? []);
      setTotalItems(data.total ?? 0);
      setTotalPages(Math.ceil((data.total ?? 0) / (data.limit || PAGINATION.DEFAULT_PAGE_SIZE)));
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setError(err.message ?? 'Ocorreu um erro inesperado.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, roleFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
    return () => abortRef.current?.abort();
  }, [fetchUsers]);

  // -------------------------------------------------------------------------
  // Filtros e paginação (sincronizados com URL)
  // -------------------------------------------------------------------------

  /** @param {number} page Índice de página (0-based). */
  const handlePageChange = useCallback((page) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(page));
      return next;
    });
  }, [setSearchParams]);

  /** @param {string} role Papel selecionado no filtro, ou '' para limpar. */
  const handleRoleFilter = useCallback((role) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', '0');
      if (role) next.set('role', role); else next.delete('role');
      return next;
    });
  }, [setSearchParams]);

  /** @param {string} value 'true', 'false' ou '' para limpar. */
  const handleActiveFilter = useCallback((value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', '0');
      if (value !== '') next.set('isActive', value); else next.delete('isActive');
      return next;
    });
  }, [setSearchParams]);

  // -------------------------------------------------------------------------
  // Exclusão
  // -------------------------------------------------------------------------

  /** @param {string} userId UUID do usuário a excluir. */
  const handleDeleteRequest = useCallback((userId) => {
    setDeleteTarget(userId);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await userService.deleteUser(deleteTarget);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(err.message ?? 'Ocorreu um erro inesperado.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, fetchUsers]);

  // -------------------------------------------------------------------------
  // Reset de senha
  // -------------------------------------------------------------------------

  /** @param {string} userId UUID do usuário cuja senha será redefinida. */
  const handleResetRequest = useCallback((userId) => {
    setResetTarget(userId);
  }, []);

  const handleResetCancel = useCallback(() => {
    setResetTarget(null);
  }, []);

  const handleResetConfirm = useCallback(async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      await userService.resetPassword(resetTarget);
      setResetTarget(null);
    } catch (err) {
      setError(err.message ?? 'Ocorreu um erro inesperado.');
      setResetTarget(null);
    } finally {
      setIsResetting(false);
    }
  }, [resetTarget]);

  return {
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
  };
}