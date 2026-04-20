import PropTypes from 'prop-types';
import { Inbox } from 'lucide-react';
import styles from './Table.module.css';

// Larguras fixas para skeleton — evita Math.random e re-renders instáveis
const SKELETON_WIDTHS = ['60%', '80%', '40%', '70%', '55%'];

/**
 * Subcomponente interno: linhas skeleton animadas exibidas durante carregamento.
 *
 * @param {object} props
 * @param {number} props.count     - Número de linhas skeleton a renderizar
 * @param {number} props.colCount  - Número de colunas (define quantos <td> por linha)
 */
function SkeletonRows({ count, colCount }) {
  return Array.from({ length: count }, (_, rowIndex) => (
    <tr key={`skeleton-${rowIndex}`} className={styles.tr}>
      {Array.from({ length: colCount }, (_, colIndex) => (
        <td key={`skeleton-cell-${colIndex}`} className={styles.td}>
          <div
            className={styles.skeletonCell}
            style={{ width: SKELETON_WIDTHS[(rowIndex + colIndex) % SKELETON_WIDTHS.length] }}
          />
        </td>
      ))}
    </tr>
  ));
}

SkeletonRows.propTypes = {
  count: PropTypes.number.isRequired,
  colCount: PropTypes.number.isRequired,
};

/**
 * Subcomponente interno: linha de estado vazio exibida quando não há dados.
 *
 * @param {object} props
 * @param {number} props.colCount  - Número de colunas (usado no colSpan)
 * @param {string} props.message   - Mensagem de estado vazio
 */
function EmptyRow({ colCount, message }) {
  return (
    <tr className={styles.tr}>
      <td colSpan={colCount} className={styles.emptyCell}>
        <div className={styles.emptyContent}>
          <Inbox size={32} aria-hidden="true" />
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}

EmptyRow.propTypes = {
  colCount: PropTypes.number.isRequired,
  message: PropTypes.string.isRequired,
};

/**
 * Componente de tabela reutilizável do HERMES.
 *
 * Suporta skeleton loading, estado vazio, linhas clicáveis, colunas com largura
 * customizada, truncamento de texto, alinhamento por coluna e cabeçalho fixo.
 *
 * @example
 * <Table
 *   columns={[
 *     { key: 'name', header: 'Nome', render: (row) => <strong>{row.name}</strong> },
 *     { key: 'status', header: 'Status', align: 'center', width: '100px' },
 *   ]}
 *   data={items}
 *   isLoading={isLoading}
 *   onRowClick={(row) => navigate(`/items/${row.id}`)}
 *   emptyMessage="Nenhum item encontrado."
 * />
 */
function Table({
  columns,
  data,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage = 'Nenhum item encontrado.',
  onRowClick,
  rowClassName,
  ariaLabel = 'Tabela de dados',
  stickyHeader = false,
}) {
  const alignClass = {
    left: styles.alignLeft,
    center: styles.alignCenter,
    right: styles.alignRight,
  };

  const tableClasses = [
    styles.table,
    stickyHeader ? styles.stickyHeader : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <table
        className={tableClasses}
        aria-label={ariaLabel}
        aria-busy={isLoading}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={[styles.th, alignClass[col.align ?? 'left']]
                  .filter(Boolean)
                  .join(' ')}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header ?? ''}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            <SkeletonRows count={skeletonRows} colCount={columns.length} />
          ) : data.length === 0 ? (
            <EmptyRow colCount={columns.length} message={emptyMessage} />
          ) : (
            data.map((row, index) => {
              const extraClass = rowClassName ? rowClassName(row, index) : undefined;
              const trClasses = [
                styles.tr,
                onRowClick ? styles.clickable : '',
                extraClass ?? '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr
                  key={row.id ?? index}
                  className={trClasses}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  role={onRowClick ? 'button' : undefined}
                  aria-label={
                    onRowClick
                      ? `Abrir linha ${index + 1}`
                      : undefined
                  }
                >
                  {columns.map((col) => {
                    const tdClasses = [
                      styles.td,
                      alignClass[col.align ?? 'left'],
                      col.truncate ? styles.truncate : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    const cellContent = col.render
                      ? col.render(row, index)
                      : (row[col.key] ?? '—');

                    return (
                      <td
                        key={col.key}
                        className={tdClasses}
                        style={col.width ? { width: col.width } : undefined}
                        title={col.truncate && typeof cellContent === 'string' ? cellContent : undefined}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

Table.propTypes = {
  /**
   * Definição das colunas da tabela.
   * Cada coluna deve ter um `key` único.
   */
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      /** Chave única da coluna — usada como key do React e para acessar row[key] quando render não fornecido */
      key: PropTypes.string.isRequired,

      /** Texto do cabeçalho — pode ser string vazia para colunas de ação */
      header: PropTypes.string,

      /**
       * Função de renderização customizada da célula.
       * Assinatura: (row: object, index: number) => ReactNode
       * Se não fornecida, exibe row[key] como texto.
       */
      render: PropTypes.func,

      /** Alinhamento do conteúdo da célula. DEFAULT: 'left' */
      align: PropTypes.oneOf(['left', 'center', 'right']),

      /**
       * Largura fixa da coluna (ex: '100px', '10%').
       * Aplicada via style inline no <th> e <td>.
       */
      width: PropTypes.string,

      /**
       * Se true, trunca conteúdo com reticências e exibe title completo no hover.
       * Útil para colunas de mensagem longa. DEFAULT: false
       */
      truncate: PropTypes.bool,
    })
  ).isRequired,

  /** Array de objetos — cada objeto é uma linha da tabela. Preferencialmente com prop `id`. */
  data: PropTypes.arrayOf(PropTypes.object).isRequired,

  /** Se true, exibe skeleton rows no lugar dos dados. DEFAULT: false */
  isLoading: PropTypes.bool,

  /** Número de linhas skeleton exibidas durante loading. DEFAULT: 5 */
  skeletonRows: PropTypes.number,

  /** Mensagem exibida quando data está vazio e não está carregando. DEFAULT: 'Nenhum item encontrado.' */
  emptyMessage: PropTypes.string,

  /**
   * Callback de clique em linha.
   * Se fornecido, linhas ficam clicáveis com cursor pointer e hover destacado.
   * Assinatura: (row: object) => void
   */
  onRowClick: PropTypes.func,

  /**
   * Permite aplicar classe CSS extra por linha.
   * Assinatura: (row: object, index: number) => string | undefined
   */
  rowClassName: PropTypes.func,

  /** aria-label da tabela para screen readers. DEFAULT: 'Tabela de dados' */
  ariaLabel: PropTypes.string,

  /** Se true, cabeçalho fixo com scroll vertical no body. DEFAULT: false */
  stickyHeader: PropTypes.bool,
};

export default Table;