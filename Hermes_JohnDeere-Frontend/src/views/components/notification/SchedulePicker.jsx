import { useId, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CalendarClock, CalendarCheck, X, ZapOff } from 'lucide-react';
import { NOTIFICATION } from '../../../core/constants/appConstants';
import styles from './SchedulePicker.module.css';

/* ------------------------------------------------------------------ */
/* Funções utilitárias de conversão de formatos de data/hora           */
/* ------------------------------------------------------------------ */

/**
 * Converte ISO 8601 → formato aceito por datetime-local (YYYY-MM-DDTHH:mm).
 * @param {string|null} iso
 * @returns {string}
 */
const toLocalInput = (iso) => (iso ? iso.slice(0, 16) : '');

/**
 * Converte datetime-local → string ISO sem timezone.
 * O backend usa LocalDateTime (sem fuso), então não convertemos para UTC.
 * datetime-local retorna "YYYY-MM-DDTHH:mm"; adicionamos ":00" para os segundos.
 * @param {string} local
 * @returns {string|null}
 */
const toISO = (local) => (local ? `${local}:00` : null);

/**
 * Formata ISO 8601 em string legível para o usuário em pt-BR.
 * Exemplo: "quinta-feira, 10 de abril de 2026 às 14:30"
 * @param {string|null} iso
 * @returns {string|null}
 */
const toPreview = (iso) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return null;
  }
};

/**
 * SchedulePicker — seletor de data e hora para agendamento de notificações.
 *
 * Wrapper acessível sobre `<input type="datetime-local">` nativo, sem dependências
 * externas. Exibe preview humanizado da data selecionada em pt-BR e suporta
 * limpeza do valor via botão X. Quando `disabled`, indica que o modo de envio
 * imediato está ativo.
 *
 * @component
 * @example
 * <SchedulePicker
 *   value={form.scheduledAt}
 *   onChange={(iso) => handleChange('scheduledAt', iso)}
 *   disabled={form.isImmediate}
 *   minDateTime={new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60000).toISOString()}
 * />
 */
const SchedulePicker = ({
  value = null,
  onChange,
  disabled = false,
  minDateTime,
  maxDateTime,
  error,
  label = 'Data e hora de envio',
  hint = 'O envio será realizado no horário do servidor (UTC-3)',
}) => {
  const id = useId();

  /* Calcula minDateTime padrão (agora + MIN_SCHEDULE_MINUTES) se não fornecido */
  const effectiveMin = useMemo(() => {
    if (minDateTime) return minDateTime;
    return new Date(
      Date.now() + (NOTIFICATION?.MIN_SCHEDULE_MINUTES ?? 15) * 60_000
    ).toISOString();
  }, [minDateTime]);

  const localValue = toLocalInput(value);
  const minLocal = toLocalInput(effectiveMin);
  const maxLocal = maxDateTime ? toLocalInput(maxDateTime) : undefined;
  const previewDate = useMemo(() => toPreview(value), [value]);

  const handleChange = useCallback(
    (e) => {
      onChange(toISO(e.target.value));
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  /* Classes do input nativo */
  const inputClass = [
    styles.input,
    error ? styles.inputError : '',
    disabled ? styles.inputDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>

      <div className={styles.inputWrapper}>
        <CalendarClock
          size={16}
          className={styles.icon}
          aria-hidden="true"
        />

        <input
          id={id}
          type="datetime-local"
          className={inputClass}
          value={localValue}
          min={minLocal}
          max={maxLocal}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            [
              previewDate && !disabled ? `${id}-preview` : null,
              disabled ? `${id}-disabled-hint` : null,
              !disabled && hint ? `${id}-hint` : null,
              error ? `${id}-error` : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />

        {localValue && !disabled && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Limpar data e hora selecionadas"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Preview amigável da data selecionada */}
      {previewDate && !disabled && (
        <span id={`${id}-preview`} className={styles.preview}>
          <CalendarCheck size={12} aria-hidden="true" />
          Agendado para {previewDate}
        </span>
      )}

      {/* Hint de modo imediato ativo */}
      {disabled && (
        <span id={`${id}-disabled-hint`} className={styles.disabledHint}>
          <ZapOff size={12} aria-hidden="true" />
          Desativado — modo de envio imediato selecionado
        </span>
      )}

      {/* Hint informativo sobre fuso horário */}
      {!disabled && hint && (
        <span id={`${id}-hint`} className={styles.hintText}>
          {hint}
        </span>
      )}

      {/* Erro externo vindo do ViewModel */}
      {error && (
        <span id={`${id}-error`} className={styles.errorText} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

SchedulePicker.propTypes = {
  /** Data/hora atual em formato ISO 8601; null quando não definido */
  value: PropTypes.string,
  /** Callback chamado com ISO string ou null ao mudar/limpar o valor */
  onChange: PropTypes.func.isRequired,
  /** Se true, campo desabilitado (modo de envio imediato ativo) */
  disabled: PropTypes.bool,
  /** Data/hora mínima permitida em ISO 8601 (padrão: agora + MIN_SCHEDULE_MINUTES) */
  minDateTime: PropTypes.string,
  /** Data/hora máxima permitida em ISO 8601 (opcional) */
  maxDateTime: PropTypes.string,
  /** Mensagem de erro vinda do ViewModel */
  error: PropTypes.string,
  /** Label do campo (padrão: 'Data e hora de envio') */
  label: PropTypes.string,
  /** Texto de dica abaixo do campo */
  hint: PropTypes.string,
};

export default SchedulePicker;