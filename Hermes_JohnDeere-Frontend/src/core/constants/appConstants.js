/**
 * @fileoverview appConstants.js — Fonte única de verdade do projeto HERMES.
 *
 * Centraliza todos os valores literais, limites de negócio, configurações de
 * infraestrutura e labels de UI que são referenciados em múltiplas camadas.
 *
 * CONVENÇÕES:
 *  - Todas as chaves em UPPER_SNAKE_CASE
 *  - Todos os objetos protegidos com Object.freeze (imutabilidade em runtime)
 *  - Enums de domínio (UserRole, NotificationStatus, etc.) vivem nos models/
 *  - Labels de UI centralizados aqui para facilitar migração futura para i18n
 *
 * @module core/constants/appConstants
 * @version 2.0.0
 */

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Configurações de infraestrutura HTTP e comportamento do cliente Axios.
 *
 * @constant {object} API
 */
export const API = Object.freeze({
  TIMEOUT_MS: 15_000,
  MAX_REFRESH_ATTEMPTS: 3,
  MAX_PAGE_SIZE: 100,
});

export const ENDPOINTS = Object.freeze({
  USERS: Object.freeze({
    BULK_IMPORT: '/api/v1/users/bulk-import',
  }),
  CELULAS: Object.freeze({
    BASE:      '/celulas',
    BY_ID:     (id) => `/celulas/${id}`,
    USUARIOS:  (id) => `/celulas/${id}/usuarios`,
  }),
});

// ---------------------------------------------------------------------------
// PAGINATION
// ---------------------------------------------------------------------------

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: Object.freeze([10, 20, 50, 100]),
});

// ---------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------

export const EMAIL = Object.freeze({
  MAX_TOTAL_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_ATTACHMENT_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_ATTACHMENT_TYPES: Object.freeze([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.ppt', '.pptx', '.csv', '.txt',
    '.png', '.jpg', '.jpeg',
  ]),
  MAX_RECIPIENTS: 50,
});

// ---------------------------------------------------------------------------
// NOTIFICATION
// ---------------------------------------------------------------------------

export const NOTIFICATION = Object.freeze({
  MAX_RETRY_ATTEMPTS: 3,
  MIN_SCHEDULE_OFFSET_MINUTES: 5,
  MAX_BURST_PER_MINUTE: 30,
});

// ---------------------------------------------------------------------------
// TEMPLATE
// ---------------------------------------------------------------------------

export const TEMPLATE = Object.freeze({
  VARIABLE_PATTERN: /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
  MAX_VERSIONS_PER_TEMPLATE: 10,
  MAX_BODY_LENGTH: 50_000,
});

// ---------------------------------------------------------------------------
// FIXED VARIABLES
// ---------------------------------------------------------------------------

/**
 * Conjunto de variáveis fixas automáticas do sistema HERMES.
 *
 * Estas variáveis são resolvidas automaticamente pelo backend no momento do
 * envio, buscando os dados do destinatário pelo e-mail na tabela users.
 *
 * Usadas pelo frontend para:
 *  - Filtrar variáveis que NÃO devem aparecer como campos preenchíveis
 *    na NotificationFormPage e no envio em massa.
 *  - Exibir a lista de variáveis disponíveis no editor de templates.
 *
 * @constant {Set<string>} FIXED_VARIABLES
 */
export const FIXED_VARIABLES = Object.freeze(new Set([
  'PRIMEIRO_NOME',
  'PRIMEIRO_ULTIMO_NOME',
  'NOME_COMPLETO',
  'EMAIL',
  'MATRICULA',
  'CARGO',
  'NOME_CELULA',
  'GESTOR_NOME',
  'GESTOR_PRIMEIRO_NOME',
  'GESTOR_EMAIL',
  'DATA_HOJE',
  'DATA_HORA_ENVIO',
  'MES_ANO',
  'ANO',
  'DIA_SEMANA',
  'SAUDACAO',
]));

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

/**
 * Mapa centralizado de todas as rotas da aplicação.
 *
 * @constant {object} ROUTES
 */
export const ROUTES = Object.freeze({
  HOME:               '/',
  LOGIN:              '/login',
  DASHBOARD:          '/dashboard',
  TEMPLATES:          '/templates',
  TEMPLATE_NEW:       '/templates/new',
  TEMPLATE_EDIT:      '/templates/:id/edit',
  CHANGE_PASSWORD:    '/change-password',
  NOTIFICATION_NEW:   '/notifications/new',
  BULK_NOTIFICATION:  '/notifications/bulk',
  USERS:              '/users',
  USER_NEW:           '/users/new',
  USER_EDIT:          (id) => `/users/${id}/edit`,
  CELULAS:            '/celulas',
  CELULA_NEW:         '/celulas/new',
  CELULA_EDIT:        (id) => `/celulas/${id}/edit`,
});

/**
 * Gera a URL de edição de template substituindo o parâmetro dinâmico :id.
 *
 * @param {string|number} id - Identificador do template.
 * @returns {string} URL resolvida, ex: "/templates/42/edit".
 */
export const buildRoute = Object.freeze({
  templateEdit: (id) => ROUTES.TEMPLATE_EDIT.replace(':id', String(id)),
});

// ---------------------------------------------------------------------------
// USER ROLE
// ---------------------------------------------------------------------------

/**
 * Enum de papéis de usuário do sistema HERMES.
 * Espelho do enum Java UserRole — deve ser mantido em sincronia.
 *
 * @constant {object} UserRole
 */
export const UserRole = Object.freeze({
  ADMIN:  'ADMIN',
  GESTOR: 'GESTOR',
  USER:   'USER',
});

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export const UI = Object.freeze({
  NOTIFICATION_STATUS_LABEL: Object.freeze({
    PENDING:   'Pendente',
    SCHEDULED: 'Agendada',
    SENT:      'Enviada',
    FAILED:    'Falhou',
  }),

  CHANNEL_LABEL: Object.freeze({
    EMAIL:    'E-mail',
    SMS:      'SMS',
    WHATSAPP: 'WhatsApp',
  }),

  USER_ROLE_LABEL: Object.freeze({
    ADMIN:  'Administrador',
    GESTOR: 'Gestor',
    USER:   'Usuário',
  }),

  NOTIFICATION_STATUS_BADGE: Object.freeze({
    PENDING:   'warning',
    SCHEDULED: 'info',
    SENT:      'success',
    FAILED:    'error',
  }),

  TOAST_DURATION_SUCCESS_MS: 3_000,
  TOAST_DURATION_ERROR_MS:   6_000,
  DASHBOARD_MAX_LIST_ITEMS:  5,
});

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export const AUTH = Object.freeze({
  TOKEN_REFRESH_MARGIN_SECONDS: 60,
  SESSION_STORAGE_UI_KEY: 'hermes:ui_prefs',
});
