import { useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Mail, X } from 'lucide-react';
import { validateEmail } from '../../../utils/validators';
import { EMAIL } from '../../../core/constants/appConstants';
import styles from './RecipientInput.module.css';

/**
 * RecipientInput — campo de entrada de e-mails com chips visuais.
 *
 * Permite ao usuário digitar endereços de e-mail que são adicionados como
 * chips/tags ao pressionar Enter, vírgula ou Tab. Valida cada e-mail via
 * `validateEmail` antes de incluí-lo na lista. Suporta remoção por clique
 * no X do chip e por Backspace quando o input está vazio.
 *
 * @component
 * @example
 * <RecipientInput
 *   label="Para"
 *   value={recipients.to}
 *   onChange={(emails) => handleRecipientsChange('to', emails)}
 *   error={fieldErrors.to}
 *   required
 * />
 */
const RecipientInput = ({
  label,
  value,
  onChange,
  error,
  placeholder = 'Digite um e-mail e pressione Enter',
  required = false,
  disabled = false,
  maxRecipients = EMAIL.MAX_RECIPIENTS,
}) => {
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  const isAtLimit = value.length >= maxRecipients;

  /** Foca o input interno ao clicar na área do campo */
  const handleFieldClick = useCallback(() => {
    if (!disabled && !isAtLimit) {
      inputRef.current?.focus();
    }
  }, [disabled, isAtLimit]);

  /** Tenta adicionar o e-mail digitado à lista */
  const tryAddEmail = useCallback(() => {
    const trimmed = inputValue.trim().replace(/,$/, '');
    if (!trimmed) return;

    if (!validateEmail(trimmed)) {
      setInputError('E-mail inválido');
      return;
    }

    if (value.includes(trimmed)) {
      setInputError('E-mail já adicionado');
      return;
    }

    setInputError('');
    setInputValue('');
    onChange([...value, trimmed]);
  }, [inputValue, value, onChange]);

  /** Remove um e-mail da lista pelo endereço */
  const removeEmail = useCallback(
    (email) => {
      onChange(value.filter((e) => e !== email));
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
        if (e.key === 'Tab' && !inputValue.trim()) return; // deixar Tab navegar normalmente se vazio
        e.preventDefault();
        tryAddEmail();
        return;
      }

      if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
        onChange(value.slice(0, -1));
        setInputError('');
      }
    },
    [inputValue, value, onChange, tryAddEmail]
  );

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
    setInputError('');

    // Adicionar imediatamente se o usuário digitou vírgula
    if (e.target.value.endsWith(',')) {
      // será tratado pelo keyDown, mas para casos de paste com vírgula:
      const val = e.target.value.slice(0, -1).trim();
      if (val && validateEmail(val)) {
        setInputValue('');
        onChange([...value, val]);
      }
    }
  }, [value, onChange]);

  const fieldClass = [
    styles.field,
    error ? styles.fieldError : '',
    disabled ? styles.fieldDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`${styles.wrapper} ${disabled ? styles.disabled : ''}`}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div
        className={fieldClass}
        onClick={handleFieldClick}
        role="group"
        aria-label={`Campo de destinatários: ${label}`}
      >
        {value.map((email) => (
          <span key={email} className={styles.chip} title={email}>
            <Mail size={12} aria-hidden="true" />
            <span className={styles.chipEmail}>{email}</span>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(email);
              }}
              aria-label={`Remover ${email}`}
              disabled={disabled}
              tabIndex={disabled ? -1 : 0}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="email"
          className={styles.input}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={tryAddEmail}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled || isAtLimit}
          aria-invalid={!!inputError || !!error}
          aria-describedby={
            [
              inputError ? `${label}-inline-error` : null,
              error ? `${label}-external-error` : null,
              isAtLimit ? `${label}-limit-hint` : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          autoComplete="off"
        />
      </div>

      {inputError && (
        <span id={`${label}-inline-error`} className={styles.inlineError} role="alert">
          {inputError}
        </span>
      )}

      {error && (
        <span id={`${label}-external-error`} className={styles.externalError} role="alert">
          {error}
        </span>
      )}

      {isAtLimit && !error && (
        <span id={`${label}-limit-hint`} className={styles.hint}>
          Limite de {maxRecipients} destinatário{maxRecipients !== 1 ? 's' : ''} atingido
        </span>
      )}
    </div>
  );
};

RecipientInput.propTypes = {
  /** Label visível acima do campo */
  label: PropTypes.string.isRequired,
  /** Array de e-mails já adicionados como chips */
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  /** Callback chamado com o novo array sempre que a lista muda */
  onChange: PropTypes.func.isRequired,
  /** Mensagem de erro externo vinda do ViewModel */
  error: PropTypes.string,
  /** Texto placeholder exibido quando não há chips */
  placeholder: PropTypes.string,
  /** Se true, exibe asterisco de campo obrigatório */
  required: PropTypes.bool,
  /** Se true, desabilita toda interação no campo */
  disabled: PropTypes.bool,
  /** Número máximo de e-mails permitidos */
  maxRecipients: PropTypes.number,
};

export default RecipientInput;