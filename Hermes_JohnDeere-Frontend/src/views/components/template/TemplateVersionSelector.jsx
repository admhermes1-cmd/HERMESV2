import PropTypes from 'prop-types';
import Badge from '../common/Badge';
import { formatDate } from '../../../utils/Formatters';
import styles from './TemplateVersionSelector.module.css';

/**
 * Gera o texto de tooltip para uma pill de versão.
 *
 * @param {object} version - Objeto TemplateVersion
 * @param {number} version.versionNumber - Número da versão
 * @param {string} [version.createdAt]  - Data de criação (ISO 8601)
 * @param {string[]} [version.variables] - Variáveis da versão
 * @returns {string} Texto do atributo `title`
 */
function buildTooltip(version) {
  const { versionNumber, createdAt, variables = [] } = version;
  const dateStr = createdAt ? formatDate(createdAt) : 'data desconhecida';
  const varCount = variables.length;
  const varLabel = varCount === 1 ? '1 variável' : `${varCount} variáveis`;
  return `Versão ${versionNumber} — criada em ${dateStr} — ${varLabel}`;
}

// ---------------------------------------------------------------------------

/**
 * Seletor horizontal de versões de um template.
 *
 * Exibe cada versão como uma pill clicável. A versão selecionada é destacada
 * com a cor primária. Versões ativas recebem um Badge "Ativa" e a versão mais
 * recente (primeira da lista) exibe "Mais recente" quando não é também a ativa.
 *
 * Componente puramente presentacional: zero lógica de negócio, apenas
 * renderização e propagação do callback `onChange`.
 *
 * @component
 *
 * @param {object}   props
 * @param {object[]} props.versions               - Lista de versões do template (ordenada desc por versionNumber)
 * @param {string}   props.versions[].id          - Identificador único da versão
 * @param {number}   props.versions[].versionNumber - Número da versão
 * @param {boolean}  [props.versions[].isActive]  - Se a versão está ativa
 * @param {string}   [props.versions[].createdAt] - Data de criação (ISO 8601)
 * @param {string[]} [props.versions[].variables] - Variáveis da versão
 * @param {string}   [props.selectedId]           - ID da versão atualmente selecionada
 * @param {Function} props.onChange               - Callback ao selecionar versão: (versionId: string) => void
 * @param {boolean}  [props.disabled=false]       - Desabilita toda interação com o seletor
 *
 * @example
 * <TemplateVersionSelector
 *   versions={versions}
 *   selectedId={selectedVersion?.id}
 *   onChange={(versionId) => handleVersionChange(versionId)}
 * />
 */
function TemplateVersionSelector({ versions, selectedId, onChange, disabled = false }) {
  if (!versions || versions.length === 0) {
    return (
      <p className={styles.empty} role="status" aria-live="polite">
        Nenhuma versão disponível
      </p>
    );
  }

  return (
    <div
      className={`${styles.container} ${disabled ? styles.disabled : ''}`}
      role="group"
      aria-label="Seletor de versões do template"
      aria-disabled={disabled}
    >
      {versions.map((version, index) => {
        const { id, versionNumber, isActive } = version;
        const isSelected = id === selectedId;
        const isMostRecent = index === 0;

        /** Badge "Mais recente" só aparece se não for também a versão ativa */
        const showMostRecentBadge = isMostRecent && !isActive;

        const tooltip = buildTooltip(version);

        function handleClick() {
          if (!disabled) {
            onChange(id);
          }
        }

        function handleKeyDown(e) {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onChange(id);
          }
        }

        return (
          <button
            key={id}
            type="button"
            className={`${styles.pill} ${isSelected ? styles.pillSelected : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            title={tooltip}
            aria-pressed={isSelected}
            aria-label={`Versão ${versionNumber}${isActive ? ', ativa' : ''}${isMostRecent ? ', mais recente' : ''}`}
            disabled={disabled}
          >
            <span className={styles.versionLabel}>v{versionNumber}</span>

            {isActive && (
              <Badge
                label="Ativa"
                variant="success"
                size="sm"
                ariaLabel="Versão ativa"
              />
            )}

            {showMostRecentBadge && (
              <Badge
                label="Mais recente"
                variant="neutral"
                size="sm"
                ariaLabel="Versão mais recente"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

TemplateVersionSelector.propTypes = {
  versions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      versionNumber: PropTypes.number.isRequired,
      isActive: PropTypes.bool,
      createdAt: PropTypes.string,
      variables: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  selectedId: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default TemplateVersionSelector;