/**
 * @fileoverview useUserFormViewModel.js
 * @module viewmodels/useUserFormViewModel
 *
 * ViewModel para o formulário de criação e edição de usuários.
 * Atualizado para suportar os campos cargo, celulaId e carregamento
 * da lista de células disponíveis para o dropdown.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { userService }      from '../services/userService';
import { celulaService }    from '../services/celulaService';
import { ROUTES }           from '../core/constants/appConstants';
import { validateUserForm } from '../utils/Validators';

/**
 * @typedef {Object} UserFormFields
 * @property {string}  name     - Nome completo do usuário.
 * @property {string}  email    - E-mail (apenas na criação).
 * @property {string}  role     - Papel: 'ADMIN' | 'GESTOR' | 'USER'.
 * @property {boolean} isActive - Situação da conta.
 * @property {string}  cargo    - Cargo/função (opcional).
 * @property {string}  celulaId - UUID da célula (obrigatório na criação).
 */

/**
 * @typedef {Object} UserFormState
 * @property {UserFormFields}         fields      - Valores dos campos do formulário.
 * @property {Object.<string,string>} fieldErrors - Mapa de erros de validação por campo.
 * @property {string|null}            submitError - Erro de submissão (vindo da API).
 * @property {boolean}                isLoading   - Carregamento inicial (modo edição).
 * @property {boolean}                isSubmitting- Submissão em andamento.
 * @property {boolean}                isEditMode  - true se o formulário está em modo edição.
 * @property {object[]}               celulas     - Lista de células para o dropdown.
 * @property {Function}               handleChange  - Atualiza um campo pelo nome.
 * @property {Function}               handleSubmit  - Valida e envia o formulário.
 */

/**
 * ViewModel para o formulário de criação e edição de usuários.
 *
 * @returns {UserFormState}
 */
export function useUserFormViewModel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [fields, setFields] = useState({
    name:     '',
    email:    '',
    role:     'USER',
    isActive: true,
    cargo:    '',
    celulaId: '',
  });

  const [fieldErrors,  setFieldErrors]  = useState({});
  const [submitError,  setSubmitError]  = useState(null);
  const [isLoading,    setIsLoading]    = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [celulas,      setCelulas]      = useState([]);

  const abortRef = useRef(null);

  // ── Carrega lista de células para o dropdown ───────────────────────────────

  useEffect(() => {
    const controller = new AbortController();

    celulaService.listCelulas({ page: 1, limit: 200 }, controller.signal)
      .then((data) => setCelulas(data.data ?? []))
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Erro ao carregar células:', err.message);
        }
      });

    return () => controller.abort();
  }, []);

  // ── Carrega dados do usuário em modo edição ───────────────────────────────

  useEffect(() => {
    if (!isEditMode) return;

    abortRef.current = new AbortController();
    setIsLoading(true);

    userService.findById(id, abortRef.current.signal)
      .then((data) => {
        setFields({
          name:     data.name     ?? '',
          email:    data.email    ?? '',
          role:     data.role     ?? 'USER',
          isActive: data.isActive ?? true,
          cargo:    data.cargo    ?? '',
          celulaId: data.celula?.id ?? '',
        });
      })
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setSubmitError(err.message ?? 'Ocorreu um erro inesperado.');
        }
      })
      .finally(() => setIsLoading(false));

    return () => abortRef.current?.abort();
  }, [id, isEditMode]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Atualiza o valor de um campo do formulário e limpa seu erro de validação.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement>} e
   */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;

    setFields((prev) => ({ ...prev, [name]: finalValue }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSubmitError(null);
  }, []);

  /**
   * Valida o formulário e, se válido, envia os dados ao service.
   * Redireciona para a listagem de usuários em caso de sucesso.
   *
   * @param {React.FormEvent} e
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const errors = validateUserForm(fields, isEditMode);

    // Validação adicional: célula obrigatória na criação
    if (!isEditMode && !fields.celulaId) {
      errors.celulaId = 'Selecione a célula do usuário.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name:     fields.name,
        role:     fields.role,
        isActive: fields.isActive,
        cargo:    fields.cargo || null,
        celulaId: fields.celulaId || null,
        ...(isEditMode ? {} : { email: fields.email }),
      };

      if (isEditMode) {
        await userService.updateUser(id, payload);
      } else {
        await userService.createUser(payload);
      }

      navigate(ROUTES.USERS);
    } catch (err) {
      setSubmitError(err.message ?? 'Ocorreu um erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  }, [fields, id, isEditMode, navigate]);

  return {
    fields,
    fieldErrors,
    submitError,
    isLoading,
    isSubmitting,
    isEditMode,
    celulas,
    handleChange,
    handleSubmit,
  };
}
