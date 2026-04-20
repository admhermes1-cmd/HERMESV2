import PropTypes from 'prop-types';
import styles from './Badge.module.css';

/**
 * Badge — componente de exibição de status, canal, role e nível de log.
 *
 * Componente puramente declarativo (sem estado interno), composto por
 * variante de cor, tamanho, indicador visual opcional (ícone ou dot)
 * e suporte completo a acessibilidade via aria-label.
 *
 * @example
 * // Status de notificação
 * <Badge label="Enviado"  variant="success" icon={CheckCircle2} />
 * <Badge label="Falha"    variant="error" />
 * <Badge label="Agendado" variant="info"  dot />
 * <Badge label="Pendente" variant="warning" />
 *
 * @example
 * // Canal de comunicação (label read-only em formulário)
 * <Badge label="E-mail"   variant="info"    size="lg" />
 * <Badge label="SMS"      variant="warning" size="lg" />
 * <Badge label="WhatsApp" variant="success" size="lg" />
 *
 * @example
 * // Role de usuário no header
 * <Badge label="ADMIN" variant="success" />
 * <Badge label="USER"  variant="neutral" />
 *
 * @example
 * // Nível de log em tabela densa
 * <Badge label="INFO"  variant="info"    size="sm" />
 * <Badge label="WARN"  variant="warning" size="sm" />
 * <Badge label="ERROR" variant="error"   size="sm" />
 */

/** @type {Record<'sm'|'md'|'lg', number>} Tamanho do ícone em px por size do badge */
const ICON_SIZE = { sm: 12, md: 14, lg: 16 };

/**
 * @param {object}  props
 * @param {string}  props.label                               — Texto exibido no badge (obrigatório)
 * @param {'success'|'error'|'warning'|'info'|'neutral'} [props.variant='neutral'] — Paleta de cor
 * @param {'sm'|'md'|'lg'} [props.size='md']                 — Tamanho do badge
 * @param {React.ElementType} [props.icon]                   — Componente de ícone lucide-react (opcional); renderizado à esquerda do label
 * @param {boolean} [props.dot=false]                        — Exibe círculo colorido à esquerda (ignorado quando icon fornecido)
 * @param {string}  [props.ariaLabel]                        — aria-label para screen readers; usa label como fallback
 */
function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  icon: Icon,
  dot = false,
  ariaLabel,
}) {
  const iconSize = ICON_SIZE[size] ?? ICON_SIZE.md;

  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${styles[size]}`}
      aria-label={ariaLabel ?? label}
    >
      {Icon ? (
        <Icon size={iconSize} aria-hidden="true" />
      ) : dot ? (
        <span className={styles.dot} aria-hidden="true" />
      ) : null}

      {label}
    </span>
  );
}

Badge.propTypes = {
  label: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['success', 'error', 'warning', 'info', 'neutral']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  icon: PropTypes.elementType,
  dot: PropTypes.bool,
  ariaLabel: PropTypes.string,
};

export default Badge;