/**
 * @fileoverview Funções de formatação puras e reutilizáveis para o sistema HERMES.
 * Todas as funções são defensivas: aceitam inputs inválidos e retornam valores seguros.
 * Nenhuma dependência de React ou de estado externo.
 *
 * @module formatters
 */

// ─────────────────────────────────────────────
// CONSTANTES INTERNAS
// ─────────────────────────────────────────────

const CHANNEL_MAP = {
  EMAIL: 'E-mail',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

const ROLE_MAP = {
  ADMIN: 'Administrador',
  USER: 'Usuário',
};

const STATUS_MAP = {
  SENT: 'Enviado',
  FAILED: 'Falha',
  PENDING: 'Pendente',
  SCHEDULED: 'Agendado',
  PROCESSING: 'Processando',
  CANCELLED: 'Cancelado',
  DONE: 'Concluído',
};

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'];

// ─────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────

/**
 * Formata uma string ISO 8601 em uma data legível em pt-BR.
 *
 * @param {string|null|undefined} isoString - Data em formato ISO 8601.
 * @param {boolean} [includeTime=false] - Se true, inclui horário na saída (modo absolute).
 * @param {'absolute'|'relative'} [mode='absolute'] - Modo de formatação.
 * @returns {string} Data formatada ou '—' se o input for inválido.
 *
 * @example
 * formatDate('2026-03-10T14:32:00.000Z')               // → "10 mar. 2026"
 * formatDate('2026-03-10T14:32:00.000Z', true)         // → "10 mar. 2026 às 14:32"
 * formatDate('2026-03-10T14:32:00.000Z', false, 'relative') // → "há 3 dias"
 * formatDate(null)                                      // → "—"
 */
export function formatDate(isoString, includeTime = false, mode = 'absolute') {
  if (!isoString) return '—';

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';

  if (mode === 'relative') {
    return _formatRelative(date);
  }

  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);

  if (!includeTime) return dateStr;

  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return `${dateStr} às ${timeStr}`;
}

/**
 * @private
 * Formata uma data como string relativa usando Intl.RelativeTimeFormat.
 *
 * @param {Date} date
 * @returns {string}
 */
function _formatRelative(date) {
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 60) return rtf.format(diffSec, 'seconds');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minutes');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hours');
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'days');
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'months');
  const diffYear = Math.round(diffMonth / 12);
  return rtf.format(diffYear, 'years');
}

/**
 * Formata um número de bytes em uma string legível com unidade apropriada.
 *
 * @param {number|null|undefined} bytes - Quantidade de bytes.
 * @param {number} [decimals=1] - Número de casas decimais.
 * @returns {string} Tamanho formatado (ex: "6 MB", "500 KB", "1,5 GB").
 *
 * @example
 * formatBytes(6291456)   // → "6 MB"
 * formatBytes(1048576)   // → "1 MB"
 * formatBytes(512000)    // → "500 KB"
 * formatBytes(850)       // → "850 B"
 * formatBytes(0)         // → "0 B"
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes == null || typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1
  );

  const value = bytes / Math.pow(1024, unitIndex);
  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);

  return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}

/**
 * Formata um número entre 0 e 1 como percentual em pt-BR.
 *
 * @param {number|null|undefined} value - Valor entre 0 e 1.
 * @param {number} [decimals=1] - Número máximo de casas decimais.
 * @returns {string} Percentual formatado (ex: "97,3%") ou "—" se inválido.
 *
 * @example
 * formatPercent(0.9734)  // → "97,3%"
 * formatPercent(1)       // → "100%"
 * formatPercent(0)       // → "0%"
 * formatPercent(null)    // → "—"
 */
export function formatPercent(value, decimals = 1) {
  if (value == null || typeof value !== 'number' || isNaN(value)) return '—';

  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Formata um identificador de canal para exibição amigável.
 *
 * @param {string|null|undefined} channel - Chave do canal (ex: 'EMAIL').
 * @returns {string} Nome formatado ou o próprio valor se desconhecido.
 *
 * @example
 * formatChannel('EMAIL')     // → "E-mail"
 * formatChannel('SMS')       // → "SMS"
 * formatChannel('WHATSAPP')  // → "WhatsApp"
 * formatChannel('PUSH')      // → "PUSH"
 */
export function formatChannel(channel) {
  if (!channel) return '';
  return CHANNEL_MAP[channel] ?? channel;
}

/**
 * Formata um identificador de role para exibição amigável.
 *
 * @param {string|null|undefined} role - Chave da role (ex: 'ADMIN').
 * @returns {string} Nome formatado ou o próprio valor se desconhecido.
 *
 * @example
 * formatRole('ADMIN')  // → "Administrador"
 * formatRole('USER')   // → "Usuário"
 * formatRole('GUEST')  // → "GUEST"
 */
export function formatRole(role) {
  if (!role) return '';
  return ROLE_MAP[role] ?? role;
}

/**
 * Formata um identificador de status para exibição amigável.
 *
 * @param {string|null|undefined} status - Chave do status (ex: 'SENT').
 * @returns {string} Nome formatado ou o próprio valor se desconhecido.
 *
 * @example
 * formatStatus('SENT')      // → "Enviado"
 * formatStatus('FAILED')    // → "Falha"
 * formatStatus('PENDING')   // → "Pendente"
 * formatStatus('SCHEDULED') // → "Agendado"
 * formatStatus('UNKNOWN')   // → "UNKNOWN"
 */
export function formatStatus(status) {
  if (!status) return '';
  return STATUS_MAP[status] ?? status;
}

/**
 * Converte um nome de variável em snake_case para Title Case legível.
 *
 * @param {string|null|undefined} snakeCase - Nome em snake_case.
 * @returns {string} Nome formatado em Title Case ou '' se inválido.
 *
 * @example
 * formatVariableName('nome_completo')   // → "Nome Completo"
 * formatVariableName('data_vencimento') // → "Data Vencimento"
 * formatVariableName('valor')           // → "Valor"
 * formatVariableName(null)              // → ""
 */
export function formatVariableName(snakeCase) {
  if (!snakeCase || typeof snakeCase !== 'string') return '';

  return snakeCase
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Trunca um texto para o comprimento máximo especificado, adicionando reticências unicode.
 *
 * @param {string|null|undefined} text - Texto a truncar.
 * @param {number} maxLength - Comprimento máximo permitido (sem contar o caractere '…').
 * @returns {string} Texto truncado com '…' ou '' se inválido.
 *
 * @example
 * truncate('Texto curto', 50)   // → "Texto curto"
 * truncate('Texto muito longo que ultrapassa o limite', 20)  // → "Texto muito longo qu…"
 * truncate(null, 50)            // → ""
 */
export function truncate(text, maxLength) {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}