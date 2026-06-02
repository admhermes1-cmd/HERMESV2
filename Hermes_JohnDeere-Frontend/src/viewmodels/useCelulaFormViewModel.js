/**
 * @fileoverview useCelulaFormViewModel.js
 * @module viewmodels/useCelulaFormViewModel
 *
 * ViewModel para CelulaFormPage — criação e edição de células.
 * Carrega lista de gestores disponíveis (role GESTOR, ativos) para o dropdown,
 * e em modo edição pré-carrega os dados da célula existente.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { celulaService } from '../services/celulaService';
import { userService }   from '../services/userService';
import { ROUTES, UserRole } from '../core/constants/appConstants';

/** Valores iniciais do formulário. */
const EMPTY_FORM = Object.freeze({ nome: '', gestorId: '' });

/**
 * @typedef {Object} CelulaFormState
 * @property {{ nome: string, gestorId: string }} fields      - Valores dos campos.
 * @property {{ nome?: string, gestorId?: string }} fieldErrors - Erros de validação por campo.
 * @property {string|null}    submitError  - Erro vindo da API.
 * @property {boolean}        isLoading    - Carregamento inicial (modo edição).
 * @property {boolean}        isSubmitting - Submissão em andamento.
 * @property {boolean}        isEditMode   - true quando a rota contém :id.
 * @property {object[]}       gestores     - Lista de gestores disponíveis para o dropdown.
 * @property {object[]}       usuarios     - Usuários vinculados (apenas modo edição, read-only).
 * @property {Function}       handleChange - Atualiza campo pelo nome.
 * @property {Function}       handleSubmit - Valida e envia.
 */

/**
 * ViewModel do formulário de célula.
 *
 * @returns {CelulaFormState}
 */
export function useCelulaFormViewModel() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const isEditMode = Boolean(id);

  const [fields,       setFields]       = useState({ ...EMPTY_FORM });
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [submitError,  setSubmitError]  = useState(null);
  const [isLoading,    setIsLoading]    = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gestores,     setGestores]     = useState([]);
  const [usuarios,     setUsuarios]     = useState([]);

  const abortRef = useRef(null);

  // ── Carrega gestores disponíveis ──────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController();

    userService.listUsers({ role: UserRole.GESTOR, isActive: true, limit: 200 }, controller.signal)
      .then((data) => {
        setGestores(data.data ?? []);
      })
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          // Falha no carregamento de gestores não bloqueia o formulário
          console.error('Erro ao carregar gestores:', err.message);
        }
      });

    return () => controller.abort();
  }, []);

  // ── Carrega dados da célula em modo edição ────────────────────────────────

  useEffect(() => {
    if (!isEditMode) return;

    abortRef.current = new AbortController();
    setIsLoading(true);

    celulaService.findById(id, abortRef.current.signal)
      .then((data) => {
        setFields({
          nome:     data.nome     ?? '',
          gestorId: data.gestor?.id ?? '',
        });
        setUsuarios(data.usuarios ?? []);
      })
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setSubmitError(err.message ?? 'Erro ao carregar dados da célula.');
        }
      })
      .finally(() => setIsLoading(false));

    return () => abortRef.current?.abort();
  }, [id, isEditMode]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Atualiza um campo do formulário e limpa seu erro de validação.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement>} e
   */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;

    setFields((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSubmitError(null);
  }, []);

  /**
   * Valida o formulário localmente e envia os dados ao service.
   * Redireciona para /celulas em caso de sucesso.
   *
   * @param {React.FormEvent} e
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const errors = {};
    if (!fields.nome.trim()) {
      errors.nome = 'O nome da célula é obrigatório.';
    }
    if (!fields.gestorId) {
      errors.gestorId = 'Selecione um gestor para a célula.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        nome:     fields.nome.trim(),
        gestorId: fields.gestorId,
      };

      if (isEditMode) {
        await celulaService.updateCelula(id, payload);
      } else {
        await celulaService.createCelula(payload);
      }

      navigate(ROUTES.CELULAS);
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
    gestores,
    usuarios,
    handleChange,
    handleSubmit,
  };
}
