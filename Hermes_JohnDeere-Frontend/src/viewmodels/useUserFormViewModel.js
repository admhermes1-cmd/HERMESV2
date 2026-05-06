import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { userService }      from '../services/userService';
import { ROUTES }           from '../core/constants/appConstants';
import { validateUserForm } from '../core/utils/Validators';

/**
 * @typedef {Object} UserFormFields
 * @property {string}  name     - Nome completo do usuário.
 * @property {string}  email    - E-mail (apenas na criação).
 * @property {string}  role     - Papel: 'ADMIN' | 'USER'.
 * @property {boolean} isActive - Situação da conta.
 */

/**
 * @typedef {Object} UserFormState
 * @property {UserFormFields}         fields      - Valores dos campos do formulário.
 * @property {Object.<string,string>} fieldErrors - Mapa de erros de validação por campo.
 * @property {string|null}            submitError - Erro de submissão (vindo da API).
 * @property {boolean}                isLoading   - Indica carregamento dos dados (modo edição).
 * @property {boolean}                isSubmitting- Indica submissão em andamento.
 * @property {boolean}                isEditMode  - {@code true} se o formulário está em modo edição.
 * @property {Function}               handleChange  - Atualiza um campo pelo nome.
 * @property {Function}               handleSubmit  - Valida e envia o formulário.
 */

/**
 * ViewModel para o formulário de criação e edição de usuários.
 *
 * <p>Em modo edição, carrega os dados do usuário existente e pré-preenche os campos.
 * O campo de e-mail é somente-leitura neste modo, refletindo a imutabilidade do
 * backend.</p>
 *
 * <p>A validação local é executada antes do envio para evitar round-trips
 * desnecessários ao servidor.</p>
 *
 * @returns {UserFormState} Estado e ações do formulário.
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
  });

  const [fieldErrors,   setFieldErrors]   = useState({});
  const [submitError,   setSubmitError]   = useState(null);
  const [isLoading,     setIsLoading]     = useState(isEditMode);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  const abortRef = useRef(null);

  // -------------------------------------------------------------------------
  // Carregamento (modo edição)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isEditMode) return;

    abortRef.current = new AbortController();
    setIsLoading(true);

    userService.findById(id, abortRef.current.signal)
      .then(data => {
        setFields({
          name:     data.name,
          email:    data.email,
          role:     data.role,
          isActive: data.isActive,
        });
      })
      .catch(err => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setSubmitError(err.message ?? 'Ocorreu um erro inesperado.');
        }
      })
      .finally(() => setIsLoading(false));

    return () => abortRef.current?.abort();
  }, [id, isEditMode]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /**
   * Atualiza o valor de um campo do formulário e limpa seu erro de validação.
   *
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement>} e - Evento de mudança.
   */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;

    setFields(prev => ({ ...prev, [name]: finalValue }));
    setFieldErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSubmitError(null);
  }, []);

  /**
   * Valida o formulário e, se válido, envia os dados ao serviço correspondente.
   * Redireciona para a listagem de usuários em caso de sucesso.
   *
   * @param {React.FormEvent} e - Evento de submissão do formulário.
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const errors = validateUserForm(fields, isEditMode);
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
    handleChange,
    handleSubmit,
  };
}