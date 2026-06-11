/**
 * @fileoverview User model — DTO puro sem lógica de negócio.
 * Contém a definição de tipos, enum de roles, factory com defaults
 * e validador leve para uso em toda a aplicação HERMES.
 *
 * @module models/User
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Papéis disponíveis para um usuário no sistema.
 * @readonly
 * @enum {string}
 */
export const UserRole = Object.freeze({
  ADMIN:  'ADMIN',
  GESTOR: 'GESTOR',
  USER:   'USER',
});

// ---------------------------------------------------------------------------
// Tipos (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} User
 * @property {string}      id                 - Identificador único (UUID).
 * @property {string}      name               - Nome completo do usuário.
 * @property {string}      email              - Endereço de e-mail (único no sistema).
 * @property {UserRole}    role               - Papel do usuário; padrão: USER.
 * @property {string|null} apiKey             - Chave de API para autenticação programática.
 * @property {string}      createdAt          - Data de criação em ISO 8601.
 * @property {boolean}     isActive           - Indica se o usuário está ativo.
 * @property {boolean}     mustChangePassword - true se o usuário deve trocar a senha no próximo login.
 */

/**
 * @typedef {Object} UserValidationResult
 * @property {boolean}  valid  - true se o modelo é válido.
 * @property {string[]} errors - Lista de mensagens de erro encontradas.
 */

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Regex básica de validação de e-mail. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Cria um objeto User com valores padrão seguros.
 * Campos ausentes em `data` recebem defaults apropriados.
 *
 * @param {Partial<User>} [data={}] - Dados parciais para inicializar o usuário.
 * @returns {Readonly<User>} Objeto User imutável.
 *
 * @example
 * const user = createUser({ name: 'Ana', email: 'ana@example.com' });
 */
export function createUser(data = {}) {
  return Object.freeze({
    id:                 data.id                 ?? '',
    name:               data.name               ?? '',
    email:              data.email              ?? '',
    role:               data.role               ?? UserRole.USER,
    apiKey:             data.apiKey             ?? null,
    createdAt:          data.createdAt          ?? new Date().toISOString(),
    isActive:           data.isActive           !== undefined ? Boolean(data.isActive)           : true,
    mustChangePassword: data.mustChangePassword !== undefined ? Boolean(data.mustChangePassword) : false,
  });
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Valida um objeto User e retorna o resultado com lista de erros.
 *
 * Regras verificadas:
 * - `name` não pode estar vazio.
 * - `email` deve ter formato válido.
 * - `role` deve ser um valor de `UserRole`.
 *
 * @param {User} user - Objeto User a ser validado.
 * @returns {UserValidationResult}
 *
 * @example
 * const { valid, errors } = validateUser(user);
 * if (!valid) console.error(errors);
 */
export function validateUser(user) {
  const errors = [];

  if (!user.name || user.name.trim() === '') {
    errors.push('name: campo obrigatório.');
  }

  if (!user.email || !EMAIL_REGEX.test(user.email)) {
    errors.push('email: formato inválido.');
  }

  if (!Object.values(UserRole).includes(user.role)) {
    errors.push(`role: valor "${user.role}" inválido. Use: ${Object.values(UserRole).join(' | ')}.`);
  }

  return { valid: errors.length === 0, errors };
}
