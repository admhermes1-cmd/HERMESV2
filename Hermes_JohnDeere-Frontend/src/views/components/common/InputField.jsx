import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './InputField.module.css';

/**
 * InputField — Componente de campo de entrada reutilizável para o sistema HERMES.
 *
 * Suporta ícones prefixados, sufixos arbitrários (ex: toggle de senha),
 * mensagens de erro/hint, contador de caracteres e estado read-only.
 *
 * @example
 * // Campo simples
 * <InputField label="Nome" name="name" value={name} onChange={handleChange} required />
 *
 * @example
 * // Campo com ícone e erro
 * <InputField
 *   label="E-mail"
 *   name="email"
 *   type="email"
 *   value={email}
 *   onChange={handleChange}
 *   prefixIcon={Mail}
 *   error="E-mail inválido"
 * />
 */
const InputField = React.forwardRef(function InputField(
  {
    label,
    name,
    id,
    type = 'text',
    value,
    onChange,
    error,
    hint,
    placeholder,
    required = false,
    readOnly = false,
    disabled = false,
    prefixIcon: PrefixIcon,
    suffix,
    maxLength,
    showCharCount = false,
    fullWidth = true,
    className,
    ...rest
  },
  ref
) {
  /**
   * Gera um id único e seguro para associar o label ao input.
   * Usa o `id` fornecido explicitamente, ou deriva do `name`.
   */
  const inputId = useMemo(
    () => id ?? name.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
    [id, name]
  );

  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  /**
   * Monta o valor de aria-describedby combinando ids de erro e hint,
   * incluindo apenas os que estão presentes no DOM.
   */
  const ariaDescribedBy = useMemo(() => {
    const parts = [];
    if (error) parts.push(errorId);
    if (!error && hint) parts.push(hintId);
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [error, hint, errorId, hintId]);

  const wrapperClass = [
    styles.wrapper,
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputClass = [
    styles.input,
    PrefixIcon ? styles.inputWithPrefix : '',
    suffix ? styles.inputWithSuffix : '',
    error ? styles.error : '',
    readOnly ? styles.readOnly : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass}>
      {/* Label sempre associado ao input via htmlFor */}
      <label htmlFor={inputId} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Wrapper relativo para posicionamento absoluto de ícones */}
      <div className={styles.inputWrapper}>
        {PrefixIcon && (
          <span className={styles.prefixIcon} aria-hidden="true">
            <PrefixIcon size={16} />
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          disabled={disabled}
          maxLength={maxLength}
          className={inputClass}
          aria-required={required ? 'true' : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-readonly={readOnly ? 'true' : undefined}
          aria-describedby={ariaDescribedBy}
          {...rest}
        />

        {suffix && <div className={styles.suffix}>{suffix}</div>}
      </div>

      {/* Mensagem de erro — role="alert" para leitores de tela */}
      {error && (
        <span id={errorId} role="alert" className={styles.errorMsg}>
          {error}
        </span>
      )}

      {/* Hint — exibido apenas quando não há erro */}
      {!error && hint && (
        <span id={hintId} className={styles.hintMsg}>
          {hint}
        </span>
      )}

      {/* Contador de caracteres — requer maxLength para ser significativo */}
      {showCharCount && maxLength && (
        <span className={styles.charCount} aria-live="polite">
          {value?.length ?? 0} / {maxLength}
        </span>
      )}
    </div>
  );
});

InputField.displayName = 'InputField';

InputField.propTypes = {
  /** Label visível acima do campo */
  label: PropTypes.string.isRequired,

  /** Nome do campo — usado para gerar id automático e associar label */
  name: PropTypes.string.isRequired,

  /** Id explícito — quando não fornecido, derivado do name */
  id: PropTypes.string,

  /** Tipo do input HTML. @default 'text' */
  type: PropTypes.string,

  /** Valor controlado do campo */
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  /** Handler de mudança — (e: Event) => void */
  onChange: PropTypes.func,

  /** Mensagem de erro — quando presente aplica estilo de erro e aria-invalid */
  error: PropTypes.string,

  /** Texto de ajuda abaixo do campo (menor, cinza) — exibido quando não há erro */
  hint: PropTypes.string,

  placeholder: PropTypes.string,

  /**
   * Se true: exibe asterisco vermelho ao lado do label e aplica aria-required.
   * @default false
   */
  required: PropTypes.bool,

  /**
   * Se true: campo não editável — estilo visual distinto (fundo acinzentado).
   * @default false
   */
  readOnly: PropTypes.bool,

  /** @default false */
  disabled: PropTypes.bool,

  /** Componente de ícone lucide-react exibido à esquerda dentro do input */
  prefixIcon: PropTypes.elementType,

  /**
   * Conteúdo arbitrário exibido à direita dentro do input.
   * Usado para botões de toggle (ex: mostrar/ocultar senha).
   */
  suffix: PropTypes.node,

  /** Limite de caracteres — quando combinado com showCharCount exibe contador */
  maxLength: PropTypes.number,

  /**
   * Se true: exibe contador "X / maxLength" abaixo do campo à direita.
   * Requer maxLength para funcionar corretamente.
   * @default false
   */
  showCharCount: PropTypes.bool,

  /**
   * Se true: InputField ocupa largura total por padrão.
   * @default true
   */
  fullWidth: PropTypes.bool,

  /** Classe CSS adicional para o wrapper externo */
  className: PropTypes.string,
};

export default InputField;