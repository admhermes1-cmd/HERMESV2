import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../core/auth/useAuth';
import { authService } from '../services/authService';
import { ROUTES } from '../core/constants/appConstants';

/** Timeout de inatividade em milissegundos (5 minutos). */
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Caracteres usados na geração de senha aleatória segura.
 * Divididos por categoria para garantir ao menos 1 de cada tipo.
 */
const CHARSET = {
  upper:   'ABCDEFGHJKLMNPQRSTUVWXYZ',  // sem I e O (confundem com 1 e 0)
  lower:   'abcdefghjkmnpqrstuvwxyz',    // sem i, l e o
  digits:  '23456789',                   // sem 0 e 1
  special: '@#$%&*!?',
};

/**
 * @typedef {Object} PasswordRule
 * @property {string}  id      - Identificador único da regra.
 * @property {string}  label   - Descrição exibida ao usuário.
 * @property {boolean} met     - Se a senha atual cumpre esta regra.
 */

/**
 * @typedef {Object} ChangePasswordState
 * @property {'form'|'success'}           step              - Etapa atual da tela.
 * @property {string}                     currentPassword   - Valor do campo de senha atual.
 * @property {string}                     newPassword       - Valor do campo de nova senha.
 * @property {string}                     confirmPassword   - Valor do campo de confirmação.
 * @property {boolean}                    showCurrent       - Toggle de visibilidade da senha atual.
 * @property {boolean}                    showNew           - Toggle de visibilidade da nova senha.
 * @property {boolean}                    showConfirm       - Toggle de visibilidade da confirmação.
 * @property {PasswordRule[]}             rules             - Checklist de regras em tempo real.
 * @property {number}                     strength          - Força da senha: 0–4.
 * @property {string|null}                submitError       - Erro vindo da API.
 * @property {Object.<string,string>}     fieldErrors       - Erros de validação por campo.
 * @property {boolean}                    isSubmitting      - Envio em andamento.
 * @property {boolean}                    copied            - Se a senha foi copiada.
 * @property {number}                     inactivityLeft    - Segundos restantes até timeout.
 * @property {Function}                   handleChange      - Atualiza um campo.
 * @property {Function}                   handleToggleShow  - Alterna visibilidade de um campo.
 * @property {Function}                   handleGenerate    - Gera senha aleatória.
 * @property {Function}                   handleSubmit      - Envia o formulário.
 * @property {Function}                   handleCopy        - Copia a nova senha para o clipboard.
 * @property {Function}                   handleConfirm     - Navega para o dashboard após sucesso.
 */

/**
 * ViewModel para a tela de troca obrigatória de senha no primeiro acesso.
 *
 * <p>Gerencia o checklist de regras em tempo real, a geração de senha segura,
 * o strength meter, o timeout de inatividade, e o fluxo de dois passos
 * (formulário → confirmação com botão copiar).</p>
 *
 * @returns {ChangePasswordState}
 */
export function useChangePasswordViewModel() {
  const navigate  = useNavigate();
  const { logout, updateUser } = useAuth();

  // ── Campos ───────────────────────────────────────────────────────────────
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]       = useState('');
  const [confirmPassword,  setConfirmPassword]   = useState('');

  // ── Visibilidade ─────────────────────────────────────────────────────────
  const [showCurrent,  setShowCurrent]  = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  // ── Estado da UI ─────────────────────────────────────────────────────────
  const [step,         setStep]         = useState('form'); // 'form' | 'success'
  const [submitError,  setSubmitError]  = useState(null);
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied,       setCopied]       = useState(false);

  // ── Timeout de inatividade ───────────────────────────────────────────────
  const [inactivityLeft, setInactivityLeft] = useState(INACTIVITY_TIMEOUT_MS / 1000);
  const inactivityRef = useRef(null);
  const countdownRef  = useRef(null);
  const logoutRef     = useRef(logout);
  const navigateRef   = useRef(navigate);

  // Mantém as refs atualizadas sem recriar o callback do timer
  useEffect(() => { logoutRef.current  = logout;   }, [logout]);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const resetInactivity = useCallback(() => {
    clearTimeout(inactivityRef.current);
    clearInterval(countdownRef.current);
    setInactivityLeft(INACTIVITY_TIMEOUT_MS / 1000);

    countdownRef.current = setInterval(() => {
      setInactivityLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    inactivityRef.current = setTimeout(async () => {
      await logoutRef.current();
      navigateRef.current(ROUTES.LOGIN, { replace: true });
    }, INACTIVITY_TIMEOUT_MS);
  }, []); // sem dependências — usa sempre as refs atualizadas

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetInactivity));
    resetInactivity();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivity));
      clearTimeout(inactivityRef.current);
      clearInterval(countdownRef.current);
    };
  }, [resetInactivity]);

  // ── Regras de senha (checklist em tempo real) ────────────────────────────

  /**
   * Verifica se a senha contém sequência numérica crescente ou decrescente (≥4 dígitos).
   * @param {string} pwd
   * @returns {boolean}
   */
  function hasSequential(pwd) {
    let asc = 1, desc = 1;
    for (let i = 1; i < pwd.length; i++) {
      const prev = pwd.charCodeAt(i - 1);
      const curr = pwd.charCodeAt(i);
      const bothDigits = pwd[i - 1] >= '0' && pwd[i - 1] <= '9' &&
                         pwd[i]     >= '0' && pwd[i]     <= '9';
      if (bothDigits) {
        if (curr - prev === 1) { asc++;  if (asc  >= 4) return true; } else asc  = 1;
        if (prev - curr === 1) { desc++; if (desc >= 4) return true; } else desc = 1;
      } else { asc = 1; desc = 1; }
    }
    return false;
  }

  /**
   * Verifica se a senha contém 3+ caracteres idênticos consecutivos.
   * @param {string} pwd
   * @returns {boolean}
   */
  function hasRepeated(pwd) {
    let count = 1;
    for (let i = 1; i < pwd.length; i++) {
      if (pwd[i] === pwd[i - 1]) { count++; if (count >= 3) return true; }
      else count = 1;
    }
    return false;
  }

  const { user } = useAuth();

  /**
   * Verifica se a senha contém parte do nome do usuário (≥3 chars, case-insensitive).
   * @param {string} pwd
   * @returns {boolean}
   */
  function hasNamePart(pwd) {
    if (!user?.name) return false;
    const lower = pwd.toLowerCase();
    return user.name.toLowerCase().split(/\s+/).some(
      part => part.length >= 3 && lower.includes(part)
    );
  }

  const rules = [
    { id: 'length',     label: 'Mínimo de 6 caracteres',                              met: newPassword.length >= 6 },
    { id: 'upper',      label: 'Pelo menos 1 letra maiúscula',                         met: /[A-Z]/.test(newPassword) },
    { id: 'lower',      label: 'Pelo menos 1 letra minúscula',                         met: /[a-z]/.test(newPassword) },
    { id: 'digit',      label: 'Pelo menos 1 número',                                  met: /\d/.test(newPassword) },
    { id: 'special',    label: 'Pelo menos 1 caractere especial (@, !, #, $…)',         met: /[^A-Za-z0-9]/.test(newPassword) },
    { id: 'sequential', label: 'Sem sequências numéricas (ex: 1234, 4321)',             met: newPassword.length > 0 && !hasSequential(newPassword) },
    { id: 'repeated',   label: 'Sem caracteres repetidos consecutivos (ex: aaa, 111)', met: newPassword.length > 0 && !hasRepeated(newPassword) },
    { id: 'noname',     label: 'Sem partes do seu nome',                               met: newPassword.length > 0 && !hasNamePart(newPassword) },
  ];

  const strength = rules.filter(r => r.met).length; // 0–8, usado para o strength meter

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleChange = useCallback((field) => (e) => {
    const value = e.target.value;
    if (field === 'current')  setCurrentPassword(value);
    if (field === 'new')      setNewPassword(value);
    if (field === 'confirm')  setConfirmPassword(value);
    setFieldErrors(prev => { const n = {...prev}; delete n[field]; return n; });
    setSubmitError(null);
  }, []);

  const handleToggleShow = useCallback((field) => {
    if (field === 'current') setShowCurrent(v => !v);
    if (field === 'new')     setShowNew(v => !v);
    if (field === 'confirm') setShowConfirm(v => !v);
  }, []);

  /**
   * Gera uma senha aleatória segura cumprindo todos os requisitos.
   * Garante ao menos 1 caractere de cada categoria e embaralha o resultado.
   */
  const handleGenerate = useCallback(() => {
    const all = CHARSET.upper + CHARSET.lower + CHARSET.digits + CHARSET.special;
    const pick = (str) => str[Math.floor(Math.random() * str.length)];

    let pwd = [
      pick(CHARSET.upper),
      pick(CHARSET.lower),
      pick(CHARSET.digits),
      pick(CHARSET.special),
    ];

    // Completa até 12 caracteres com chars aleatórios do conjunto completo
    while (pwd.length < 12) {
      const candidate = pick(all);
      // Evita repetições consecutivas na geração
      if (pwd[pwd.length - 1] !== candidate) {
        pwd.push(candidate);
      }
    }

    // Fisher-Yates shuffle
    for (let i = pwd.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }

    const generated = pwd.join('');
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNew(true);
    setShowConfirm(true);
    setFieldErrors({});
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const errors = {};

    if (!currentPassword) errors.current = 'Informe sua senha atual.';
    if (!newPassword)      errors.new     = 'Informe a nova senha.';

    const allRulesMet = rules.every(r => r.met);
    if (newPassword && !allRulesMet) {
      errors.new = 'A senha não cumpre todos os requisitos listados.';
    }
    if (newPassword !== confirmPassword) {
      errors.confirm = 'As senhas não coincidem.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await authService.changePassword({ currentPassword, newPassword });
      setStep('success');
    } catch (err) {
      setSubmitError(err.message ?? 'Ocorreu um erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentPassword, newPassword, confirmPassword, rules]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback para ambientes sem clipboard API
      const el = document.createElement('textarea');
      el.value = newPassword;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [newPassword]);

  const handleConfirm = useCallback(() => {
  updateUser({ mustChangePassword: false });
  navigate(ROUTES.DASHBOARD, { replace: true });
}, [navigate, updateUser]);

  return {
    step,
    currentPassword,
    newPassword,
    confirmPassword,
    showCurrent,
    showNew,
    showConfirm,
    rules,
    strength,
    submitError,
    fieldErrors,
    isSubmitting,
    copied,
    inactivityLeft,
    handleChange,
    handleToggleShow,
    handleGenerate,
    handleSubmit,
    handleCopy,
    handleConfirm,
  };
}