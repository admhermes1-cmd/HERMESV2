/**
 * @fileoverview Template model — DTO puro sem lógica de negócio.
 * Modela templates de mensagem com suporte a múltiplas versões e
 * múltiplos canais de comunicação.
 *
 * Regra de negócio chave (implementada aqui como utilitário):
 * se nenhuma versão for indicada no envio, usa-se a mais recente.
 *
 * @module models/Template
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Canais de comunicação suportados pelo HERMES.
 * Adicione novos canais aqui conforme a expansão do sistema.
 * @readonly
 * @enum {string}
 */
export const TemplateChannel = Object.freeze({
  EMAIL:    'EMAIL',
  SMS:      'SMS',
  WHATSAPP: 'WHATSAPP',
});

// ---------------------------------------------------------------------------
// Tipos (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} TemplateVersion
 * @property {string}   id            - Identificador único da versão (UUID).
 * @property {string}   templateId    - ID do template pai.
 * @property {number}   versionNumber - Número sequencial da versão (1, 2, 3…).
 * @property {string}   subject       - Assunto da mensagem (relevante para EMAIL).
 * @property {string}   body          - Corpo da mensagem (texto puro ou HTML).
 * @property {string[]} variables     - Nomes das lacunas presentes no body, ex.: ["userName","orderCode"].
 * @property {boolean}  isActive      - Indica se esta versão está ativa.
 * @property {string}   createdAt     - Data de criação em ISO 8601.
 */

/**
 * @typedef {Object} Template
 * @property {string}            id          - Identificador único (UUID).
 * @property {string}            name        - Nome descritivo do template.
 * @property {string}            description - Descrição do propósito do template.
 * @property {TemplateChannel}   channel     - Canal de comunicação ao qual pertence.
 * @property {TemplateVersion[]} versions    - Histórico de versões do template.
 * @property {string}            createdAt   - Data de criação em ISO 8601.
 * @property {string}            updatedAt   - Data da última atualização em ISO 8601.
 * @property {string}            createdBy   - ID do usuário que criou o template.
 */

/**
 * @typedef {Object} TemplateValidationResult
 * @property {boolean}  valid  - true se o modelo é válido.
 * @property {string[]} errors - Lista de mensagens de erro encontradas.
 */

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Extrai nomes de variáveis de um corpo de template.
 * Detecta o padrão {{variableName}}.
 *
 * @param {string} body - Corpo do template.
 * @returns {string[]} Array de nomes únicos das variáveis encontradas.
 */
function extractVariables(body) {
  if (!body) return [];
  const matches = body.match(/\{\{(\w+)\}\}/g) ?? [];
  const names = matches.map(m => m.replace(/\{\{|\}\}/g, ''));
  return [...new Set(names)];
}

// ---------------------------------------------------------------------------
// Factory — TemplateVersion
// ---------------------------------------------------------------------------

/**
 * Cria um objeto TemplateVersion com valores padrão seguros.
 * As variáveis são extraídas automaticamente do body quando não fornecidas.
 *
 * @param {Partial<TemplateVersion>} [data={}] - Dados parciais da versão.
 * @returns {Readonly<TemplateVersion>}
 *
 * @example
 * const v = createTemplateVersion({
 *   templateId: 'tpl-1',
 *   subject: 'Bem-vindo, {{userName}}!',
 *   body: '<p>Olá, {{userName}}. Seu pedido {{orderCode}} foi confirmado.</p>',
 * });
 */
export function createTemplateVersion(data = {}) {
  const body = data.body ?? '';

  return Object.freeze({
    id:            data.id            ?? '',
    templateId:    data.templateId    ?? '',
    versionNumber: data.versionNumber ?? 1,
    subject:       data.subject       ?? '',
    body,
    variables:     Array.isArray(data.variables)
                     ? [...data.variables]
                     : extractVariables(body),
    isActive:      data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt:     data.createdAt ?? new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Factory — Template
// ---------------------------------------------------------------------------

/**
 * Cria um objeto Template com valores padrão seguros.
 *
 * @param {Partial<Template>} [data={}] - Dados parciais do template.
 * @returns {Readonly<Template>}
 *
 * @example
 * const tpl = createTemplate({ name: 'Boas-vindas', channel: TemplateChannel.EMAIL });
 */
export function createTemplate(data = {}) {
  const now = new Date().toISOString();

  return Object.freeze({
    id:          data.id          ?? '',
    name:        data.name        ?? '',
    description: data.description ?? '',
    channel:     data.channel     ?? TemplateChannel.EMAIL,
    versions:    Array.isArray(data.versions)
                   ? data.versions.map(v => createTemplateVersion(v))
                   : [],
    createdAt:   data.createdAt   ?? now,
    updatedAt:   data.updatedAt   ?? now,
    createdBy:   data.createdBy   ?? '',
  });
}

// ---------------------------------------------------------------------------
// Utilitário de negócio
// ---------------------------------------------------------------------------

/**
 * Retorna a versão mais recente e ativa de um template.
 * Caso não haja nenhuma versão ativa, retorna `null`.
 *
 * @param {Template} template - Template a ser inspecionado.
 * @returns {TemplateVersion|null}
 *
 * @example
 * const latest = getLatestVersion(template);
 * if (!latest) throw new Error('Template sem versão ativa.');
 */
export function getLatestVersion(template) {
  if (!template?.versions?.length) return null;

  const activeVersions = template.versions.filter(v => v.isActive);
  if (!activeVersions.length) return null;

  return activeVersions.reduce((latest, current) =>
    current.versionNumber > latest.versionNumber ? current : latest
  );
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/**
 * Valida um objeto TemplateVersion.
 *
 * Regras verificadas:
 * - `templateId` obrigatório.
 * - `subject` obrigatório.
 * - `body` obrigatório.
 * - `versionNumber` deve ser inteiro positivo.
 *
 * @param {TemplateVersion} version
 * @returns {TemplateValidationResult}
 */
export function validateTemplateVersion(version) {
  const errors = [];

  if (!version.templateId || version.templateId.trim() === '') {
    errors.push('templateId: campo obrigatório.');
  }

  if (!version.subject || version.subject.trim() === '') {
    errors.push('subject: campo obrigatório.');
  }

  if (!version.body || version.body.trim() === '') {
    errors.push('body: campo obrigatório.');
  }

  if (!Number.isInteger(version.versionNumber) || version.versionNumber < 1) {
    errors.push('versionNumber: deve ser um inteiro positivo.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida um objeto Template.
 *
 * Regras verificadas:
 * - `name` obrigatório.
 * - `channel` deve ser um valor de `TemplateChannel`.
 * - `createdBy` obrigatório.
 * - Cada versão presente é validada individualmente.
 *
 * @param {Template} template
 * @returns {TemplateValidationResult}
 */
export function validateTemplate(template) {
  const errors = [];

  if (!template.name || template.name.trim() === '') {
    errors.push('name: campo obrigatório.');
  }

  if (!Object.values(TemplateChannel).includes(template.channel)) {
    errors.push(
      `channel: valor "${template.channel}" inválido. Use: ${Object.values(TemplateChannel).join(' | ')}.`
    );
  }

  if (!template.createdBy || template.createdBy.trim() === '') {
    errors.push('createdBy: campo obrigatório.');
  }

  template.versions?.forEach((version, index) => {
    const result = validateTemplateVersion(version);
    if (!result.valid) {
      result.errors.forEach(err => errors.push(`versions[${index}].${err}`));
    }
  });

  return { valid: errors.length === 0, errors };
}