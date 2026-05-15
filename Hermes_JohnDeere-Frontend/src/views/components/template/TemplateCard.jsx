import PropTypes from 'prop-types';
import { Mail, Smartphone, MessageCircle, GitBranch, Clock, Pencil, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { formatDate } from '../../../utils/Formatters';
import { UI } from '../../../core/constants/appConstants';
import styles from './TemplateCard.module.css';

/**
 * Retorna o ícone Lucide correspondente ao canal do template.
 *
 * @param {string} channel - Canal do template ('EMAIL' | 'SMS' | 'WHATSAPP')
 * @returns {React.ComponentType} Componente de ícone Lucide
 */
function getChannelIcon(channel) {
  switch (channel) {
    case 'EMAIL':
      return Mail;
    case 'SMS':
      return Smartphone;
    case 'WHATSAPP':
      return MessageCircle;
    default:
      return Mail;
  }
}

/**
 * Retorna a classe CSS do ícone do canal.
 *
 * @param {string} channel - Canal do template ('EMAIL' | 'SMS' | 'WHATSAPP')
 * @returns {string} Nome da classe CSS do módulo
 */
function getChannelIconClass(channel) {
  switch (channel) {
    case 'EMAIL':
      return styles.channelIconEmail;
    case 'SMS':
      return styles.channelIconSms;
    case 'WHATSAPP':
      return styles.channelIconWhatsapp;
    default:
      return styles.channelIconEmail;
  }
}

/**
 * Retorna a variante do Badge para o canal.
 *
 * @param {string} channel - Canal do template ('EMAIL' | 'SMS' | 'WHATSAPP')
 * @returns {string} Variante do Badge
 */
function getChannelBadgeVariant(channel) {
  return UI.BADGE_VARIANTS?.[channel] ?? 'info';
}

/**
 * Retorna o rótulo legível do canal.
 *
 * @param {string} channel - Canal do template ('EMAIL' | 'SMS' | 'WHATSAPP')
 * @returns {string} Rótulo do canal
 */
function getChannelLabel(channel) {
  return UI.CHANNEL_LABELS?.[channel] ?? channel;
}

// ---------------------------------------------------------------------------

/**
 * Card visual para exibição de um template de notificação.
 *
 * Usado em `TemplatesPage` como alternativa visual à tabela (exibição em grid).
 * Componente puramente presentacional: zero lógica de negócio, apenas renderização
 * e propagação de callbacks.
 *
 * @component
 *
 * @param {object}   props
 * @param {object}   props.template              - Dados do template a exibir
 * @param {string}   props.template.id           - Identificador único do template
 * @param {string}   props.template.name         - Nome do template
 * @param {string}   [props.template.description]- Descrição do template
 * @param {string}   props.template.channel      - Canal: 'EMAIL' | 'SMS' | 'WHATSAPP'
 * @param {Array}    [props.template.versions]   - Lista de versões do template
 * @param {string}   [props.template.createdAt]  - Data de criação (ISO 8601)
 * @param {string}   [props.template.updatedAt]  - Data de atualização (ISO 8601)
 * @param {Function} [props.onEdit]              - Callback ao clicar em Editar: (id: string) => void
 * @param {Function} [props.onDelete]            - Callback ao clicar em Excluir: (template: object) => void
 * @param {boolean}  [props.isAdmin=false]       - Exibe ações de admin (Editar / Excluir)
 *
 * @example
 * <TemplateCard
 *   template={template}
 *   onEdit={(id) => navigate(ROUTES.TEMPLATE_EDIT(id))}
 *   onDelete={(t) => setDeleteTarget(t)}
 *   isAdmin={true}
 * />
 */
function TemplateCard({ template, onEdit, onDelete, isAdmin = false }) {
  const {
    id,
    name,
    description,
    channel,
    versions = [],
    updatedAt,
  } = template;

  const ChannelIcon = getChannelIcon(channel);
  const channelIconClass = getChannelIconClass(channel);
  const badgeVariant = getChannelBadgeVariant(channel);
  const channelLabel = getChannelLabel(channel);
  const versionCount = versions.length;

  /** Impede que o clique nos botões do footer propague para o card inteiro. */
  function handleActionClick(e) {
    e.stopPropagation();
  }

  function handleEditClick(e) {
    handleActionClick(e);
    onEdit?.(id);
  }

  function handleDeleteClick(e) {
    handleActionClick(e);
    onDelete?.(template);
  }

  function handleCardClick() {
    if (isAdmin) {
      onEdit?.(id);
    }
  }

  function handleCardKeyDown(e) {
    if (isAdmin && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onEdit?.(id);
    }
  }

  return (
    <article
      className={`${styles.card} ${isAdmin ? styles.cardClickable : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={isAdmin ? 'button' : 'article'}
      tabIndex={isAdmin ? 0 : undefined}
      aria-label={isAdmin ? `Editar template ${name}` : `Template ${name}`}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={`${styles.channelIcon} ${channelIconClass}`} aria-hidden="true">
          <ChannelIcon size={20} />
        </div>

        <h3 className={styles.name} title={name}>
          {name}
        </h3>

        <Badge
          label={channelLabel}
          variant={badgeVariant}
          size="sm"
          ariaLabel={`Canal: ${channelLabel}`}
        />
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className={styles.body}>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : (
          <p className={styles.noDescription}>Sem descrição</p>
        )}

        <div className={styles.meta} aria-label="Metadados do template">
          <span className={styles.metaItem}>
            <GitBranch size={14} aria-hidden="true" />
            <span>{versionCount} {versionCount === 1 ? 'versão' : 'versões'}</span>
          </span>

          {updatedAt && (
            <span className={styles.metaItem}>
              <Clock size={14} aria-hidden="true" />
              <span>Atualizado em {formatDate(updatedAt)}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Footer (admin only) ────────────────────────────────── */}
      {isAdmin && (
        <footer className={styles.footer} role="group" aria-label={`Ações do template ${name}`}>
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil size={14} />}
            onClick={handleEditClick}
            ariaLabel={`Editar template ${name}`}
          >
            Editar
          </Button>

          <span className={styles.divider} aria-hidden="true" />

          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={handleDeleteClick}
            ariaLabel={`Excluir template ${name}`}
            className={styles.deleteBtn}
          >
            Excluir
          </Button>
        </footer>
      )}
    </article>
  );
}

TemplateCard.propTypes = {
  template: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    channel: PropTypes.string.isRequired,
    versions: PropTypes.array,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  isAdmin: PropTypes.bool,
};

export default TemplateCard;