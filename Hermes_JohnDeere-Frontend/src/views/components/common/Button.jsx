import React from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner.jsx';
import styles from './Button.module.css';

/**
 * Button — componente de ação reutilizável do sistema HERMES.
 *
 * Suporta quatro variantes visuais, três tamanhos, modo ícone-only,
 * estado de loading integrado com LoadingSpinner e acessibilidade completa.
 *
 * @example
 * // Botão primário com ícone
 * <Button variant="primary" icon={Plus} onClick={handleNew}>
 *   Novo Template
 * </Button>
 *
 * @example
 * // Botão de loading em submit
 * <Button type="submit" isLoading={isSubmitting}>
 *   Entrar
 * </Button>
 *
 * @example
 * // Botão ícone-only acessível
 * <Button variant="ghost" iconOnly icon={Pencil} ariaLabel="Editar template" />
 */
const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    type = 'button',
    icon: IconComponent,
    iconOnly = false,
    ariaLabel,
    isLoading = false,
    disabled = false,
    fullWidth = false,
    onClick,
    ...rest
  },
  ref
) {
  // Aviso de desenvolvimento: iconOnly sem ariaLabel quebra acessibilidade
  if (process.env.NODE_ENV !== 'production' && iconOnly && !ariaLabel) {
    console.warn(
      '[Button] Prop `ariaLabel` é obrigatória quando `iconOnly` é true. ' +
        'Screen readers não terão como descrever este botão.'
    );
  }

  const isDisabled = disabled || isLoading;

  /** Intercepta clicks quando desabilitado ou em loading */
  const handleClick = (event) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  /** Tamanho do ícone proporcional ao size do botão */
  const iconSize = { sm: 14, md: 16, lg: 18 }[size];

  /**
   * Cor do spinner coerente com a legibilidade de cada variante:
   * - primary/danger → fundo escuro → spinner branco
   * - secondary      → fundo claro  → spinner verde
   * - ghost          → fundo claro  → spinner cinza
   */
  const spinnerColorMap = {
    primary: '#ffffff',
    danger: '#ffffff',
    secondary: 'var(--color-primary)',
    ghost: 'var(--color-text-secondary)',
  };
  const spinnerColor = spinnerColorMap[variant] ?? '#ffffff';

  // Composição das classes CSS
  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    iconOnly ? styles.iconOnly : '',
    fullWidth ? styles.fullWidth : '',
    isDisabled && !isLoading ? styles.disabled : '',
    isLoading ? styles.loading : '',
  ]
    .filter(Boolean)
    .join(' ');

  /** Conteúdo à esquerda do label: spinner (loading) ou ícone */
  const leadingContent = (() => {
    if (isLoading) {
      return <LoadingSpinner size="sm" color={spinnerColor} />;
    }
    if (IconComponent) {
      return <IconComponent size={iconSize} aria-hidden="true" />;
    }
    return null;
  })();

  return (
    <button
      ref={ref}
      type={type}
      className={classNames}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-busy={isLoading ? 'true' : undefined}
      aria-label={ariaLabel}
      {...rest}
    >
      {leadingContent}
      {!iconOnly && children}
    </button>
  );
});

Button.displayName = 'Button';

Button.propTypes = {
  /** Conteúdo textual do botão — omitido quando iconOnly */
  children: PropTypes.node,

  /**
   * Variante visual do botão.
   * - `primary`   → verde sólido, ação principal
   * - `secondary` → borda verde, fundo transparente
   * - `danger`    → vermelho sólido, ação destrutiva
   * - `ghost`     → sem borda nem fundo, ação terciária
   */
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),

  /**
   * Tamanho do botão.
   * - `sm` → compacto, para cards e tabelas
   * - `md` → padrão
   * - `lg` → CTA proeminente
   */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),

  /** Tipo HTML nativo do elemento button */
  type: PropTypes.oneOf(['button', 'submit', 'reset']),

  /**
   * Componente de ícone do lucide-react.
   * Renderizado à esquerda do children, ou centralizado quando iconOnly.
   * @example icon={Plus}
   */
  icon: PropTypes.elementType,

  /**
   * Renderiza apenas o ícone, sem children.
   * Requer `ariaLabel` para acessibilidade.
   */
  iconOnly: PropTypes.bool,

  /**
   * aria-label para screen readers.
   * Obrigatório quando iconOnly; exibe console.warn em dev se ausente.
   */
  ariaLabel: PropTypes.string,

  /**
   * Exibe LoadingSpinner, desabilita interações e aplica aria-busy.
   */
  isLoading: PropTypes.bool,

  /** Desabilita o botão, aplica estilo de opacidade e cursor not-allowed */
  disabled: PropTypes.bool,

  /** Aplica width: 100% — para formulários e layouts mobile */
  fullWidth: PropTypes.bool,

  /** Handler de clique — bloqueado automaticamente quando disabled ou isLoading */
  onClick: PropTypes.func,
};

export default Button;