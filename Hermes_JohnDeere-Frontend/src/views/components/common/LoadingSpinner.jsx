import PropTypes from 'prop-types';
import styles from './LoadingSpinner.module.css';

/**
 * LoadingSpinner — componente de carregamento reutilizável do HERMES.
 *
 * Cobre todos os contextos de uso do projeto:
 * - `fullscreen`: overlay fixo na viewport (PrivateRoute, Suspense fallback)
 * - `overlay`: overlay absoluto no container pai (seções em carregamento)
 * - padrão inline: ocupa apenas o espaço do pai (botões, seções)
 *
 * @component
 * @example
 * // Fullscreen — verificação de sessão / lazy load de página
 * <LoadingSpinner fullscreen />
 *
 * @example
 * // Área de conteúdo — carregamento de dados de página
 * <LoadingSpinner size="lg" label="Carregando template..." />
 *
 * @example
 * // Inline em botão — estado de submissão
 * <LoadingSpinner size="sm" color="white" />
 *
 * @example
 * // Overlay sobre container pai
 * <LoadingSpinner overlay label="Salvando..." />
 */
function LoadingSpinner({
  size = 'md',
  color = 'var(--color-primary)',
  label,
  fullscreen = false,
  overlay = false,
}) {
  const ariaLabel = label ?? 'Carregando...';

  const wrapperClass = [
    styles.wrapper,
    fullscreen ? styles.fullscreen : '',
    overlay && !fullscreen ? styles.overlay : '',
  ]
    .filter(Boolean)
    .join(' ');

  const spinnerClass = [styles.spinner, styles[size]].join(' ');

  return (
    <div
      className={wrapperClass}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {/* Elemento visual do spinner — cor injetada via custom property inline */}
      <div
        className={spinnerClass}
        style={{ '--spinner-color': color }}
        aria-hidden="true"
      />

      {/* Texto sempre presente para screen readers, mesmo sem label visível */}
      <span className={styles.srOnly}>{ariaLabel}</span>

      {/* Label visível — exibida apenas quando fornecida explicitamente */}
      {label && (
        <span className={styles.label} aria-hidden="true">
          {label}
        </span>
      )}
    </div>
  );
}

LoadingSpinner.propTypes = {
  /**
   * Tamanho do spinner.
   * - `'sm'` → 16px — uso inline em botões
   * - `'md'` → 32px — uso padrão em seções (DEFAULT)
   * - `'lg'` → 48px — uso em páginas inteiras
   */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),

  /**
   * Cor do arco giratório.
   * Aceita qualquer valor CSS válido (hex, rgb, variável CSS, named color).
   * @default 'var(--color-primary)'
   */
  color: PropTypes.string,

  /**
   * Texto exibido abaixo do spinner (visível ao usuário).
   * Quando omitido, apenas o aria-label "Carregando..." é enviado a screen readers.
   */
  label: PropTypes.string,

  /**
   * Se `true`, o spinner ocupa 100% da viewport com overlay semi-transparente fixo.
   * Indicado para PrivateRoute e Suspense fallback.
   * @default false
   */
  fullscreen: PropTypes.bool,

  /**
   * Se `true`, aplica um overlay semi-transparente sobre o container pai (position absolute).
   * Diferente de `fullscreen`: este é relativo ao pai, não à viewport.
   * Ignorado quando `fullscreen` também for `true`.
   * @default false
   */
  overlay: PropTypes.bool,
};

export default LoadingSpinner;