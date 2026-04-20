/**
 * @fileoverview Tokens de design em JavaScript — espelho do global.css
 *
 * Use CSS custom properties (var(--color-primary)) em componentes CSS/CSS Modules.
 * Use este arquivo apenas quando precisar dos valores em contexto JavaScript:
 *
 * ✅ Use theme.js para:
 *   - Cálculos dinâmicos de layout (ex: posicionamento com JS)
 *   - Bibliotecas de terceiros que não leem CSS vars (ex: Chart.js, Canvas API)
 *   - Testes unitários que verificam valores de estilo
 *   - Geração de estilos inline via style prop do React
 *
 * ❌ Prefira CSS vars para:
 *   - Estilização em CSS Modules (.module.css)
 *   - Qualquer propriedade CSS padrão em componentes
 *
 * IMPORTANTE: Este arquivo é imutável em runtime (Object.freeze).
 * Para alterar tokens, edite global.css E este arquivo em sincronia.
 *
 * @module theme
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Grupos de tokens individuais
// Exportados separadamente para tree-shaking — importe apenas o que usar:
//   import { colors } from '@/styles/theme'
// ---------------------------------------------------------------------------

/**
 * Paleta de cores — John Deere + semânticas
 * @type {Readonly<Record<string, string>>}
 */
export const colors = Object.freeze({
  // Primária — Verde John Deere
  primary:      '#367C2B',
  primaryDark:  '#2a5f20',
  primaryLight: '#4a9e3a',

  // Derivadas com opacidade
  primary10: 'rgba(54, 124, 43, 0.1)',

  // Secundária — Amarelo John Deere
  secondary: '#FFDE00',

  // Fundos e superfícies
  bg:      '#f5f6fa',
  surface: '#ffffff',

  // Bordas
  border: '#e0e0e0',

  // Texto
  textPrimary:   '#1a1a1a',
  textSecondary: '#6b7280',

  // Semânticas
  error:   '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  info:    '#2563eb',

  // Derivadas semânticas com opacidade
  error10:   'rgba(220, 38, 38, 0.1)',
  success10: 'rgba(22, 163, 74, 0.1)',
});

/**
 * Escala de espaçamento — base 4px
 * @type {Readonly<Record<string, string>>}
 */
export const spacing = Object.freeze({
  xs:  '4px',
  sm:  '8px',
  md:  '16px',
  lg:  '24px',
  xl:  '32px',
  '2xl': '48px',
});

/**
 * Escala tipográfica
 * @type {Readonly<Record<string, string>>}
 */
export const fontSize = Object.freeze({
  sm:   '0.875rem',  // ~14px
  base: '1rem',      // 16px
  lg:   '1.125rem',  // 18px
  xl:   '1.25rem',   // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '1.875rem', // 30px
});

/**
 * Pesos tipográficos
 * @type {Readonly<Record<string, number>>}
 */
export const fontWeight = Object.freeze({
  normal:   400,
  medium:   500,
  semibold: 600,
  bold:     700,
});

/**
 * Família tipográfica
 * @type {Readonly<Record<string, string>>}
 */
export const fontFamily = Object.freeze({
  sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Roboto Mono', 'Courier New', monospace",
});

/**
 * Raios de borda
 * @type {Readonly<Record<string, string>>}
 */
export const borderRadius = Object.freeze({
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  full: '9999px',
});

/**
 * Sombras — camadas de elevação
 * @type {Readonly<Record<string, string>>}
 */
export const shadows = Object.freeze({
  sm: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.05)',
});

/**
 * Dimensões estruturais do layout
 * @type {Readonly<Record<string, string | number>>}
 */
export const layout = Object.freeze({
  sidebarWidth:          '240px',
  sidebarCollapsedWidth: '64px',
  headerHeight:          '64px',
  contentMaxWidth:       '1280px',

  // Z-index como números para cálculos JS
  zSidebar: 100,
  zHeader:  200,
  zModal:   1000,
  zToast:   1100,
});

/**
 * Durações e easing de transições
 * @type {Readonly<Record<string, string>>}
 */
export const transitions = Object.freeze({
  fast: '0.15s ease',
  base: '0.2s ease',
  slow: '0.3s ease',

  // Apenas durações — para uso com propriedades CSS individuais
  durationFast: '0.15s',
  durationBase: '0.2s',
  durationSlow: '0.3s',

  easing: 'ease',
});

// ---------------------------------------------------------------------------
// Objeto raiz — composição de todos os grupos
// ---------------------------------------------------------------------------

/**
 * Tema completo do HERMES — todos os design tokens em um único objeto.
 *
 * Imutável via Object.freeze() para prevenir mutação acidental em runtime.
 *
 * @example
 * // Uso em biblioteca de terceiros (ex: Chart.js)
 * import { colors } from '@/styles/theme'
 *
 * const chartOptions = {
 *   scales: {
 *     x: { grid: { color: colors.border } }
 *   }
 * }
 *
 * @type {Readonly<{
 *   colors: typeof colors,
 *   spacing: typeof spacing,
 *   fontSize: typeof fontSize,
 *   fontWeight: typeof fontWeight,
 *   fontFamily: typeof fontFamily,
 *   borderRadius: typeof borderRadius,
 *   shadows: typeof shadows,
 *   layout: typeof layout,
 *   transitions: typeof transitions,
 * }>}
 */
export const theme = Object.freeze({
  colors,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  borderRadius,
  shadows,
  layout,
  transitions,
});

export default theme;