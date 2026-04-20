/**
 * @fileoverview Funções de validação puras e reutilizáveis para o sistema HERMES.
 * Todas as funções são defensivas: aceitam inputs inválidos e retornam valores seguros.
 * Nenhuma dependência de React ou de estado externo.
 *
 * @module validators
 */

import { formatBytes } from './Formatters.js';

// ─────────────────────────────────────────────
// CONSTANTES INTERNAS
// ─────────────────────────────────────────────

/**
 * Regex de e-mail baseado em RFC 5322 — simplificado mas robusto.
 * Cobre a grande maioria dos endereços reais sem aceitar padrões claramente inválidos.
 *
 * Rejeita: strings sem @, sem domínio, com espaços, com caracteres proibidos.
 * Aceita: subdomínios, aliases com +, TLDs longos (ex: .museum, .technology).
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// ─────────────────────────────────────────────
// VALIDATORS
// ─────────────────────────────────────────────

/**
 * Valida se uma string é um endereço de e-mail válido.
 *
 * @param {string|null|undefined} email - E-mail a validar.
 * @returns {boolean} true se válido, false caso contrário.
 *
 * @example
 * validateEmail('user@example.com')   // → true
 * validateEmail('user+alias@sub.domain.com') // → true
 * validateEmail('invalido')           // → false
 * validateEmail('')                   // → false
 * validateEmail(null)                 // → false
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Valida uma lista de endereços de e-mail, retornando erros individuais para cada inválido.
 *
 * @param {string[]} emails - Array de e-mails a validar.
 * @returns {{ valid: boolean, errors: string[] }} Resultado consolidado da validação.
 *
 * @example
 * validateEmailList(['a@b.com', 'c@d.com'])
 * // → { valid: true, errors: [] }
 *
 * validateEmailList(['a@b.com', 'invalido'])
 * // → { valid: false, errors: ['invalido não é um e-mail válido'] }
 *
 * validateEmailList([])
 * // → { valid: true, errors: [] }
 */
export function validateEmailList(emails) {
  if (!Array.isArray(emails) || emails.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors = emails
    .filter((email) => !validateEmail(email))
    .map((email) => `${email} não é um e-mail válido`);

  return { valid: errors.length === 0, errors };
}

/**
 * Valida se o tamanho total de uma lista de arquivos não excede o limite permitido.
 *
 * @param {Array<{ size: number }>|null|undefined} files - Array de objetos com propriedade `.size` em bytes (compatível com File nativo).
 * @param {number} maxBytes - Tamanho máximo permitido em bytes.
 * @returns {{ valid: boolean, totalSize: number, message?: string }} Resultado da validação.
 *
 * @example
 * validateAttachmentSize([{ size: 5242880 }], 10485760)
 * // → { valid: true, totalSize: 5242880 }
 *
 * validateAttachmentSize([{ size: 8388608 }, { size: 4194304 }], 10485760)
 * // → { valid: false, totalSize: 12582912, message: 'Tamanho total excede o limite de 10 MB' }
 *
 * validateAttachmentSize([], 10485760)
 * // → { valid: true, totalSize: 0 }
 */
export function validateAttachmentSize(files, maxBytes) {
  if (!Array.isArray(files) || files.length === 0) {
    return { valid: true, totalSize: 0 };
  }

  const totalSize = files.reduce((acc, file) => {
    const size = file?.size;
    return acc + (typeof size === 'number' && !isNaN(size) ? size : 0);
  }, 0);

  if (totalSize > maxBytes) {
    return {
      valid: false,
      totalSize,
      message: `Tamanho total excede o limite de ${formatBytes(maxBytes)}`,
    };
  }

  return { valid: true, totalSize };
}

/**
 * Valida se a extensão de um arquivo está na lista de extensões permitidas.
 *
 * @param {string|null|undefined} filename - Nome do arquivo (ex: 'relatorio.pdf').
 * @param {string[]} allowedExtensions - Array de extensões permitidas sem ponto, em lowercase (ex: ['pdf', 'jpg']).
 * @returns {boolean} true se a extensão for permitida, false caso contrário.
 *
 * @example
 * validateAttachmentExtension('relatorio.pdf', ['pdf', 'docx'])  // → true
 * validateAttachmentExtension('imagem.PNG', ['png', 'jpg'])      // → true (case-insensitive)
 * validateAttachmentExtension('virus.exe', ['pdf', 'docx'])      // → false
 * validateAttachmentExtension('arquivo', ['pdf'])                 // → false
 * validateAttachmentExtension(null, ['pdf'])                      // → false
 */
export function validateAttachmentExtension(filename, allowedExtensions) {
  if (!filename || typeof filename !== 'string') return false;
  if (!Array.isArray(allowedExtensions) || allowedExtensions.length === 0) return false;

  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) return false;

  const ext = filename.slice(lastDotIndex + 1).toLowerCase();
  return allowedExtensions.map((e) => e.toLowerCase()).includes(ext);
}

/**
 * Valida se um valor obrigatório está preenchido (não vazio, não só espaços).
 *
 * @param {*} value - Valor a validar.
 * @returns {boolean} true se preenchido, false se ausente ou vazio.
 *
 * @example
 * validateRequired('valor')   // → true
 * validateRequired('')        // → false
 * validateRequired('  ')      // → false (trim)
 * validateRequired(null)      // → false
 * validateRequired(undefined) // → false
 */
export function validateRequired(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
}

/**
 * Valida se um valor string tem comprimento mínimo após trim.
 *
 * @param {string|null|undefined} value - Valor a validar.
 * @param {number} min - Comprimento mínimo exigido.
 * @returns {boolean} true se o comprimento for maior ou igual ao mínimo.
 *
 * @example
 * validateMinLength('ab', 3)   // → false
 * validateMinLength('abc', 3)  // → true
 * validateMinLength('  a', 1)  // → true (trim aplicado)
 * validateMinLength(null, 1)   // → false
 */
export function validateMinLength(value, min) {
  if (!value || typeof value !== 'string') return false;
  return value.trim().length >= min;
}

/**
 * Valida se um valor string não excede o comprimento máximo.
 *
 * @param {string|null|undefined} value - Valor a validar.
 * @param {number} max - Comprimento máximo permitido.
 * @returns {boolean} true se o comprimento for menor ou igual ao máximo.
 *
 * @example
 * validateMaxLength('texto longo', 5)  // → false
 * validateMaxLength('ok', 5)           // → true
 * validateMaxLength(null, 5)           // → false
 */
export function validateMaxLength(value, max) {
  if (!value || typeof value !== 'string') return false;
  return value.length <= max;
}

/**
 * Valida se todas as variáveis obrigatórias de um template foram preenchidas.
 *
 * @param {string[]} requiredVariables - Lista de chaves obrigatórias.
 * @param {{ [key: string]: string }} variables - Mapa de variáveis com seus valores preenchidos.
 * @returns {{ valid: boolean, missing: string[] }} Resultado com lista de chaves ausentes.
 *
 * @example
 * validateTemplateVariables(
 *   ['nome', 'empresa', 'valor'],
 *   { nome: 'João', empresa: '', valor: '100' }
 * )
 * // → { valid: false, missing: ['empresa'] }
 *
 * validateTemplateVariables([], {})
 * // → { valid: true, missing: [] }
 *
 * validateTemplateVariables(['nome'], { nome: 'Maria' })
 * // → { valid: true, missing: [] }
 */
export function validateTemplateVariables(requiredVariables, variables) {
  if (!Array.isArray(requiredVariables) || requiredVariables.length === 0) {
    return { valid: true, missing: [] };
  }

  const safeVariables = variables && typeof variables === 'object' ? variables : {};

  const missing = requiredVariables.filter((key) => {
    const val = safeVariables[key];
    return !val || (typeof val === 'string' && val.trim() === '');
  });

  return { valid: missing.length === 0, missing };
}

/**
 * Valida se uma data de agendamento é válida — deve ser futura e respeitar
 * o intervalo mínimo de antecedência em minutos.
 *
 * @param {string|null|undefined} isoString - Data em formato ISO 8601.
 * @param {number} minMinutes - Antecedência mínima em minutos.
 * @returns {{ valid: boolean, message?: string }} Resultado da validação.
 *
 * @example
 * validateScheduledAt('2026-04-15T14:00:00.000Z', 30)
 * // → { valid: true }
 *
 * validateScheduledAt(null, 30)
 * // → { valid: false, message: 'Data de agendamento obrigatória' }
 *
 * validateScheduledAt('2020-01-01T00:00:00.000Z', 30)
 * // → { valid: false, message: 'A data de agendamento deve ser no futuro' }
 *
 * validateScheduledAt('2026-04-13T00:00:05.000Z', 30)
 * // → { valid: false, message: 'O agendamento deve ser feito com no mínimo 30 minutos de antecedência' }
 */
export function validateScheduledAt(isoString, minMinutes) {
  if (!isoString) {
    return { valid: false, message: 'Data de agendamento obrigatória' };
  }

  const scheduledDate = new Date(isoString);
  if (isNaN(scheduledDate.getTime())) {
    return { valid: false, message: 'Data de agendamento inválida' };
  }

  const now = Date.now();
  const scheduledMs = scheduledDate.getTime();

  if (scheduledMs <= now) {
    return { valid: false, message: 'A data de agendamento deve ser no futuro' };
  }

  const diffMinutes = (scheduledMs - now) / (1000 * 60);

  if (diffMinutes < minMinutes) {
    return {
      valid: false,
      message: `O agendamento deve ser feito com no mínimo ${minMinutes} minutos de antecedência`,
    };
  }

  return { valid: true };
}