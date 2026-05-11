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
 * @module core/constants/appConstant
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Configurações de infraestrutura HTTP e comportamento do cliente Axios.
 *
 * @constant {object} API
 * @property {number} TIMEOUT_MS               - Timeout padrão de requisições em milissegundos.
 * @property {number} MAX_REFRESH_ATTEMPTS     - Quantas vezes o interceptor tenta renovar o
 *                                               JWT antes de forçar logout. Evita loops infinitos
 *                                               em caso de falha persistente no endpoint de refresh.
 * @property {number} MAX_PAGE_SIZE            - Teto de itens por página aceito pela API.
 *                                               Protege o backend de requisições abusivas.
 */
export const API = Object.freeze({
  TIMEOUT_MS: 15_000,
  MAX_REFRESH_ATTEMPTS: 3,
  MAX_PAGE_SIZE: 100,
});

// ---------------------------------------------------------------------------
// PAGINATION
// ---------------------------------------------------------------------------

/**
 * Configurações de paginação para listagens e seletores de UI.
 *
 * @constant {object} PAGINATION
 * @property {number}   DEFAULT_PAGE_SIZE     - Quantidade de itens exibida por padrão
 *                                              nas tabelas da aplicação.
 * @property {number[]} PAGE_SIZE_OPTIONS     - Opções disponíveis no seletor de "itens por página".
 *                                              Deve ser um subconjunto de valores ≤ API.MAX_PAGE_SIZE.
 */
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: Object.freeze([10, 20, 50, 100]),
});

// ---------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------

/**
 * Limites e restrições para envio de e-mails.
 *
 * Referência de performance (RNF): 1.000 e-mails/dia, burst de 20–30/min.
 *
 * @constant {object} EMAIL
 * @property {number}   MAX_TOTAL_SIZE_BYTES      - Tamanho máximo do e-mail completo (cabeçalhos
 *                                                  + corpo + todos os anexos) em bytes.
 *                                                  Valor: 10 MB = 10 × 1024 × 1024.
 * @property {number}   MAX_ATTACHMENT_SIZE_BYTES - Tamanho máximo por anexo individual em bytes.
 *                                                  Definido em 5 MB: metade do limite total,
 *                                                  permitindo ao menos dois anexos de porte médio
 *                                                  sem estourar o teto global. Alinhado com limites
 *                                                  comuns de provedores SMTP corporativos.
 * @property {string[]} ALLOWED_ATTACHMENT_TYPES  - Extensões de arquivo aceitas para anexo.
 *                                                  Restringidas a formatos de uso corporativo comum,
 *                                                  excluindo executáveis e scripts para segurança.
 * @property {number}   MAX_RECIPIENTS            - Limite total de destinatários (TO + CC + BCC).
 *                                                  50 endereços é um teto seguro para uso corporativo
 *                                                  e respeita as políticas anti-spam da maioria dos
 *                                                  provedores SMTP sem configuração adicional.
 */
export const EMAIL = Object.freeze({
  MAX_TOTAL_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_ATTACHMENT_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_ATTACHMENT_TYPES: Object.freeze([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.csv',
    '.txt',
    '.png',
    '.jpg',
    '.jpeg',
  ]),
  MAX_RECIPIENTS: 50,
});

// ---------------------------------------------------------------------------
// NOTIFICATION
// ---------------------------------------------------------------------------

/**
 * Parâmetros de controle de envio e agendamento de notificações.
 *
 * @constant {object} NOTIFICATION
 * @property {number} MAX_RETRY_ATTEMPTS         - Número máximo de tentativas de reenvio para
 *                                                 uma mensagem agendada que falhou. Após esgotar
 *                                                 as tentativas, o status passa para FAILED.
 * @property {number} MIN_SCHEDULE_OFFSET_MINUTES - Antecedência mínima, em minutos, para agendar
 *                                                  uma notificação a partir do momento atual.
 *                                                  Evita agendamentos imediatos que bypassariam
 *                                                  a fila e sobrecarregariam o worker.
 * @property {number} MAX_BURST_PER_MINUTE        - Burst máximo de envios por minuto, conforme
 *                                                  requisito não funcional do sistema. Usado como
 *                                                  referência para rate-limiting e alertas.
 */
export const NOTIFICATION = Object.freeze({
  MAX_RETRY_ATTEMPTS: 3,
  MIN_SCHEDULE_OFFSET_MINUTES: 5,
  MAX_BURST_PER_MINUTE: 30,
});

// ---------------------------------------------------------------------------
// TEMPLATE
// ---------------------------------------------------------------------------

/**
 * Configurações e restrições para gerenciamento de templates de mensagem.
 *
 * @constant {object} TEMPLATE
 * @property {RegExp} VARIABLE_PATTERN       - Expressão regular para identificar variáveis
 *                                             de substituição no corpo do template.
 *                                             Formato esperado: {{nome_variavel}}.
 *                                             Captura o nome da variável no grupo 1.
 *                                             Exemplo: "Olá, {{nome}}!" → captura "nome".
 * @property {number} MAX_VERSIONS_PER_TEMPLATE - Número máximo de versões mantidas por template.
 *                                               10 versões oferecem histórico suficiente para
 *                                               auditoria e rollback sem consumo excessivo de
 *                                               armazenamento.
 * @property {number} MAX_BODY_LENGTH           - Tamanho máximo do corpo do template em caracteres.
 *                                               50.000 caracteres é adequado para e-mails ricos
 *                                               em HTML; SMS e WhatsApp são validados pela camada
 *                                               de negócio antes do envio com seus próprios limites
 *                                               de canal.
 */
export const TEMPLATE = Object.freeze({
  VARIABLE_PATTERN: /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
  MAX_VERSIONS_PER_TEMPLATE: 10,
  MAX_BODY_LENGTH: 50_000,
});

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

/**
 * Mapa centralizado de todas as rotas da aplicação.
 *
 * Use estas constantes em <Link to={ROUTES.LOGIN}>, navigate(ROUTES.DASHBOARD),
 * e na definição do AppRouter — nunca strings literais hardcoded nos componentes.
 *
 * Para rotas com parâmetros dinâmicos, use a função auxiliar abaixo:
 * @see buildRoute
 *
 * @constant {object} ROUTES
 * @property {string} HOME                - Redireciona para o dashboard após autenticação.
 * @property {string} LOGIN               - Página de autenticação.
 * @property {string} DASHBOARD          - Visão geral com métricas e atividades recentes.
 * @property {string} TEMPLATES          - Listagem de templates.
 * @property {string} TEMPLATE_NEW       - Formulário de criação de novo template.
 * @property {string} TEMPLATE_EDIT      - Formulário de edição; contém parâmetro :id.
 * @property {string} NOTIFICATION_NEW   - Formulário de envio/agendamento de notificação.
 */
export const ROUTES = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  TEMPLATES: '/templates',
  TEMPLATE_NEW: '/templates/new',
  CHANGE_PASSWORD: '/change-password',
  TEMPLATE_EDIT: '/templates/:id/edit',
  NOTIFICATION_NEW: '/notifications/new',
  USERS:     '/users',
  USER_NEW:  '/users/new',
  USER_EDIT: (id) => `/users/${id}/edit`,
});

/**
 * Gera a URL de edição de template substituindo o parâmetro dinâmico :id.
 *
 * @param {string|number} id - Identificador do template.
 * @returns {string} URL resolvida, ex: "/templates/42/edit".
 *
 * @example
 * navigate(buildRoute.templateEdit(template.id));
 */
export const buildRoute = Object.freeze({
  templateEdit: (id) => ROUTES.TEMPLATE_EDIT.replace(':id', String(id)),
});

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

/**
 * Labels, variantes de badge e configurações de interface do usuário.
 *
 * Todos os textos visíveis ao usuário estão centralizados aqui para facilitar
 * a futura adoção de um sistema de i18n (ex: react-i18next). A migração
 * consistirá em substituir os valores literais por chamadas t('chave') sem
 * alterar os componentes que consomem estas constantes.
 *
 * @constant {object} UI
 *
 * @property {object} NOTIFICATION_STATUS_LABEL  - Mapeamento de status de notificação → label PT-BR.
 * @property {object} CHANNEL_LABEL              - Mapeamento de canal → label amigável.
 * @property {object} USER_ROLE_LABEL            - Mapeamento de role → label PT-BR.
 *
 * @property {object} NOTIFICATION_STATUS_BADGE  - Variante de badge por status de notificação.
 *                                                 Os valores correspondem às props aceitas pelo
 *                                                 componente <Badge variant="..."> em components/common/.
 *
 * @property {number} TOAST_DURATION_SUCCESS_MS  - Tempo de exibição de toast de sucesso em ms.
 * @property {number} TOAST_DURATION_ERROR_MS    - Tempo de exibição de toast de erro em ms.
 *                                                 Erros ficam mais tempo para garantir leitura.
 *
 * @property {number} DASHBOARD_MAX_LIST_ITEMS   - Número máximo de itens exibidos em listas
 *                                                 resumidas no painel (ex: "Últimas notificações").
 */
export const UI = Object.freeze({
  // --- Labels de status de notificação (i18n-ready) ---
  NOTIFICATION_STATUS_LABEL: Object.freeze({
    PENDING: 'Pendente',
    SCHEDULED: 'Agendada',
    SENT: 'Enviada',
    FAILED: 'Falhou',
  }),

  // --- Labels de canal de comunicação (i18n-ready) ---
  CHANNEL_LABEL: Object.freeze({
    EMAIL: 'E-mail',
    SMS: 'SMS',
    WHATSAPP: 'WhatsApp',
  }),

  // --- Labels de role de usuário (i18n-ready) ---
  USER_ROLE_LABEL: Object.freeze({
    ADMIN: 'Administrador',
    USER: 'Usuário',
  }),

  // --- Variantes de badge por status (mapeiam para props do componente <Badge>) ---
  NOTIFICATION_STATUS_BADGE: Object.freeze({
    PENDING: 'warning',
    SCHEDULED: 'info',
    SENT: 'success',
    FAILED: 'error',
  }),

  // --- Duração de toasts/snackbars ---
  TOAST_DURATION_SUCCESS_MS: 3_000,
  TOAST_DURATION_ERROR_MS: 6_000,

  // --- Dashboard ---
  DASHBOARD_MAX_LIST_ITEMS: 5,
});

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

/**
 * Configurações de autenticação e gerenciamento de sessão.
 *
 * O token JWT é armazenado exclusivamente em memória (variável de módulo no
 * apiClient.js) para mitigar ataques XSS. O refreshToken trafega via cookie
 * httpOnly, portanto nunca é acessível pelo JavaScript do cliente.
 *
 * @constant {object} AUTH
 * @property {number} TOKEN_REFRESH_MARGIN_SECONDS - Antecedência em segundos com que o interceptor
 *                                                   agenda a renovação do JWT antes de ele expirar.
 *                                                   60 segundos provê margem suficiente para latência
 *                                                   de rede sem renovações excessivamente antecipadas.
 * @property {string} SESSION_STORAGE_UI_KEY        - Chave usada no sessionStorage para persistir
 *                                                   preferências de UI não-sensíveis (ex: tema,
 *                                                   página ativa, tamanho de paginação escolhido).
 *                                                   Dados sensíveis (tokens, credenciais) NUNCA
 *                                                   devem ser gravados com esta chave.
 */
export const AUTH = Object.freeze({
  TOKEN_REFRESH_MARGIN_SECONDS: 60,
  SESSION_STORAGE_UI_KEY: 'hermes:ui_prefs',
});
