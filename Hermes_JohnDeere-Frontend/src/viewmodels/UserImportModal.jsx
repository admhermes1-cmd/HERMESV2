import { useRef, useState, useCallback } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  RotateCcw,
  Users,
} from "lucide-react";
import Modal from "../views/components/common/Modal";
import Button from "../views/components/common/Button";
import { useUserImportViewModel } from "./UseUserImportViewModel";
import styles from "./UserImportModal.module.css";

/**
 * Modal de importação em massa de usuários — design Opção A (claro, stepper lateral).
 *
 * Fluxo em 3 etapas controladas pelo ViewModel:
 *   1. idle    → seleção de arquivo (drop zone)
 *   2. preview → tabela client-side com validação linha a linha
 *   3. result  → resumo pós-importação com accordion de falhas
 *
 * Localização: src/views/components/UserImportModal.jsx
 *
 * @param {{ isOpen: boolean, onClose: () => void, onSuccess?: () => void }} props
 */
export default function UserImportModal({ isOpen, onClose, onSuccess }) {
  const vm = useUserImportViewModel();

  const fileInputRef              = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [failuresOpen, setFailuresOpen] = useState(false);

  // ── Drag handlers ─────────────────────────────────────────────────────

  const onDragOver  = useCallback((e) => { e.preventDefault(); setIsDragOver(true);  }, []);
  const onDragLeave = useCallback(() => setIsDragOver(false), []);
  const onDrop      = useCallback((e) => { setIsDragOver(false); vm.handleDrop(e); }, [vm]);

  // ── Close ─────────────────────────────────────────────────────────────

  const handleClose = () => {
    vm.handleReset();
    onClose();
  };

  const handleFinish = () => {
    if (vm.result?.successCount > 0) onSuccess?.();
    handleClose();
  };

  // ── Template downloads ─────────────────────────────────────────────────

  const triggerDownload = (content, filename, mime) => {
    const url  = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () =>
    triggerDownload(
      "name,email,role,password\nJoão Silva,joao@empresa.com,USER,\nMaria Souza,maria@empresa.com,ADMIN,senha123",
      "template_usuarios.csv",
      "text/csv;charset=utf-8;"
    );

  const downloadJson = () =>
    triggerDownload(
      JSON.stringify(
        [
          { name: "João Silva",  email: "joao@empresa.com",  role: "USER",  password: "" },
          { name: "Maria Souza", email: "maria@empresa.com", role: "ADMIN", password: "senha123" },
        ],
        null,
        2
      ),
      "template_usuarios.json",
      "application/json"
    );

  // ── Stepper ────────────────────────────────────────────────────────────

  const steps = [
    { key: "idle",    label: "Arquivo",  desc: "CSV ou JSON" },
    { key: "preview", label: "Preview",  desc: "Validar dados" },
    { key: "result",  label: "Resultado", desc: "Criar usuários" },
  ];

  const stepIndex = { idle: 0, preview: 1, result: 2 }[vm.stage];

  const renderStepper = () => (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon} aria-hidden="true">
          <Users size={17} />
        </div>
        <span className={styles.brandName}>HERMES</span>
      </div>

      <nav className={styles.stepList} aria-label="Etapas da importação">
        {steps.map((step, i) => {
          const isDone    = i < stepIndex;
          const isActive  = i === stepIndex;
          const isPending = i > stepIndex;

          return (
            <div key={step.key}>
              <div
                className={[
                  styles.stepItem,
                  isDone    ? styles.stepDone    : "",
                  isActive  ? styles.stepActive  : "",
                  isPending ? styles.stepPending : "",
                ].join(" ")}
                aria-current={isActive ? "step" : undefined}
              >
                <div className={styles.stepNum} aria-hidden="true">
                  {isDone ? "✓" : i + 1}
                </div>
                <div className={styles.stepText}>
                  <span className={styles.stepTitle}>{step.label}</span>
                  {(isDone || isActive) && (
                    <span className={styles.stepDesc}>
                      {isDone && step.key === "idle" && vm.selectedFile
                        ? vm.selectedFile.name
                        : step.desc}
                    </span>
                  )}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={styles.stepConnector} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );

  // ── Etapa 1: Upload ─────────────────────────────────────────────────────

  const renderIdle = () => (
    <div className={styles.idleStage}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Área de upload. Arraste um arquivo ou pressione Enter para selecionar."
        className={[
          styles.dropZone,
          isDragOver ? styles.dropZoneDragOver : "",
        ].join(" ")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className={styles.hiddenInput}
          tabIndex={-1}
          aria-hidden="true"
          onChange={vm.handleFileSelect}
        />
        <div className={styles.dropIcon} aria-hidden="true">
          <Upload size={24} />
        </div>
        <p className={styles.dropTitle}>
          Arraste o arquivo aqui ou{" "}
          <span className={styles.dropLink}>clique para selecionar</span>
        </p>
        <p className={styles.dropHint}>CSV ou JSON · máx 5 MB</p>
        <div className={styles.formatChips} aria-hidden="true">
          <span className={styles.chip}>.csv</span>
          <span className={styles.chip}>.json</span>
        </div>
      </div>

      {/* Erro */}
      {vm.error && (
        <div role="alert" className={styles.errorBanner}>
          <AlertCircle size={15} aria-hidden="true" />
          <span>{vm.error}</span>
        </div>
      )}

      {/* Templates */}
      <div className={styles.templateRow}>
        <span className={styles.templateLabel}>Baixar modelo:</span>
        <button type="button" className={styles.templateBtn} onClick={downloadCsv}>
          <Download size={12} aria-hidden="true" /> template.csv
        </button>
        <button type="button" className={styles.templateBtn} onClick={downloadJson}>
          <Download size={12} aria-hidden="true" /> template.json
        </button>
      </div>

      {/* Legenda de colunas */}
      <div className={styles.legend}>
        <p className={styles.legendTitle}>Colunas esperadas</p>
        <div className={styles.legendGrid}>
          {[
            { col: "name",     req: true,  desc: "Nome completo" },
            { col: "email",    req: true,  desc: "E-mail único" },
            { col: "role",     req: true,  desc: "ADMIN ou USER" },
            { col: "password", req: false, desc: "Opcional — gerada se vazia" },
          ].map(({ col, req, desc }) => (
            <div key={col} className={styles.legendRow}>
              <code className={styles.legendCode}>{col}</code>
              <span className={req ? styles.badgeRequired : styles.badgeOptional}>
                {req ? "obrigatório" : "opcional"}
              </span>
              <span className={styles.legendDesc}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Etapa 2: Preview ────────────────────────────────────────────────────

  const renderPreview = () => (
    <div className={styles.previewStage}>
      {/* Cabeçalho com contadores */}
      <div className={styles.previewHeader}>
        <div className={styles.previewFileInfo}>
          <FileText size={16} aria-hidden="true" className={styles.previewFileIcon} />
          <span className={styles.previewFileName}>{vm.selectedFile?.name}</span>
        </div>
        <div className={styles.previewStats}>
          <span className={styles.statChipTotal}>{vm.previewRows.length} linhas</span>
          <span className={styles.statChipOk}>✓ {vm.validRows.length} válidas</span>
          {vm.invalidRows.length > 0 && (
            <span className={styles.statChipErr}>✗ {vm.invalidRows.length} erro(s)</span>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className={styles.tableWrap} role="region" aria-label="Pré-visualização dos dados">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">name</th>
              <th scope="col">email</th>
              <th scope="col">role</th>
              <th scope="col">status</th>
            </tr>
          </thead>
          <tbody>
            {vm.previewRows.map((row) => (
              <tr key={row.index} className={row.valid ? "" : styles.rowError}>
                <td>{row.index}</td>
                <td>{row.name  || <span className={styles.empty}>—</span>}</td>
                <td>{row.email || <span className={styles.empty}>—</span>}</td>
                <td>{row.role  || <span className={styles.empty}>—</span>}</td>
                <td>
                  {row.valid ? (
                    <span className={styles.statusOk}>✓ válido</span>
                  ) : (
                    <div>
                      <span className={styles.statusErr}>✗ erro</span>
                      {row.error && (
                        <p className={styles.rowErrMsg}>{row.error}</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Aviso de linhas inválidas */}
      {vm.invalidRows.length > 0 && (
        <div className={styles.previewNotice} role="status">
          <AlertCircle size={14} aria-hidden="true" />
          <span>
            {vm.invalidRows.length === vm.previewRows.length
              ? "Nenhuma linha válida encontrada. Corrija o arquivo e tente novamente."
              : `${vm.invalidRows.length} linha(s) serão ignoradas. Os demais `
                + `${vm.validRows.length} usuários serão criados e receberão e-mails de boas-vindas.`}
          </span>
        </div>
      )}

      {/* Erro de requisição */}
      {vm.error && (
        <div role="alert" className={styles.errorBanner}>
          <AlertCircle size={15} aria-hidden="true" />
          <span>{vm.error}</span>
        </div>
      )}
    </div>
  );

  // ── Etapa 3: Resultado ──────────────────────────────────────────────────

  const renderResult = () => {
    const { result } = vm;
    if (!result) return null;

    const hasFailures = result.failureCount > 0;
    const hasSuccess  = result.successCount > 0;

    return (
      <div className={styles.resultStage} role="region" aria-label="Resultado da importação">
        {/* Cards de resumo */}
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryNum}>{result.totalRows}</span>
            <span className={styles.summaryLbl}>Total</span>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardOk}`}>
            <span className={styles.summaryNum}>{result.successCount}</span>
            <span className={styles.summaryLbl}>Criados</span>
          </div>
          <div className={`${styles.summaryCard} ${hasFailures ? styles.summaryCardErr : ""}`}>
            <span className={styles.summaryNum}>{result.failureCount}</span>
            <span className={styles.summaryLbl}>Falhas</span>
          </div>
        </div>

        {/* Banner de status */}
        {hasSuccess && !hasFailures && (
          <div role="status" className={`${styles.statusBanner} ${styles.bannerSuccess}`}>
            <CheckCircle size={15} aria-hidden="true" />
            <span>Todos os usuários foram importados com sucesso!</span>
          </div>
        )}
        {hasSuccess && hasFailures && (
          <div role="status" className={`${styles.statusBanner} ${styles.bannerWarning}`}>
            <AlertCircle size={15} aria-hidden="true" />
            <span>
              Importação parcial: {result.successCount} criado(s), {result.failureCount} com falha(s).
            </span>
          </div>
        )}
        {!hasSuccess && hasFailures && (
          <div role="alert" className={`${styles.statusBanner} ${styles.bannerError}`}>
            <AlertCircle size={15} aria-hidden="true" />
            <span>Nenhum usuário foi importado. Corrija os erros e tente novamente.</span>
          </div>
        )}

        {/* Accordion de falhas */}
        {hasFailures && (
          <div className={styles.failuresSection}>
            <button
              type="button"
              className={styles.failuresToggle}
              onClick={() => setFailuresOpen((v) => !v)}
              aria-expanded={failuresOpen}
              aria-controls="failures-list"
            >
              <AlertCircle size={13} aria-hidden="true" />
              <span>Ver {result.failureCount} linha(s) com erro</span>
              {failuresOpen
                ? <ChevronUp  size={13} aria-hidden="true" />
                : <ChevronDown size={13} aria-hidden="true" />}
            </button>

            {failuresOpen && (
              <ul
                id="failures-list"
                className={styles.failuresList}
                aria-label="Erros por linha"
              >
                {result.failures.map((f) => (
                  <li key={f.rowIndex} className={styles.failureItem}>
                    <span className={styles.failureRow}>Linha {f.rowIndex}</span>
                    <span className={styles.failureEmail}>{f.email || "—"}</span>
                    <span className={styles.failureReason}>{f.errorReason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Footer dinâmico ────────────────────────────────────────────────────

  const renderFooter = () => {
    if (vm.stage === "result") {
      return (
        <>
          <Button variant="ghost" icon={RotateCcw} onClick={vm.handleReset}>
            Importar outro
          </Button>
          <Button variant="primary" onClick={handleFinish}>
            Concluir
          </Button>
        </>
      );
    }

    if (vm.stage === "preview") {
      return (
        <>
          <Button variant="ghost" onClick={vm.goBack} disabled={vm.isLoading}>
            ← Voltar
          </Button>
          <Button
            variant="primary"
            onClick={vm.handleImport}
            isLoading={vm.isLoading}
            disabled={vm.isLoading || vm.validRows.length === 0}
          >
            {vm.isLoading
              ? "Importando…"
              : `Importar ${vm.validRows.length} usuário(s)`}
          </Button>
        </>
      );
    }

    // idle
    return (
      <>
        <Button variant="ghost" onClick={handleClose}>
          Cancelar
        </Button>
        <Button variant="primary" disabled>
          Próximo →
        </Button>
      </>
    );
  };

  // ── Título do Modal (passado ao componente Modal via prop title) ─────────

  const modalTitle = {
    idle:    "Importar Usuários em Massa",
    preview: "Preview do Arquivo",
    result:  "Resultado da Importação",
  }[vm.stage];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      size="lg"
      footer={renderFooter()}
    >
      <div className={styles.layout}>
        {renderStepper()}

        <div className={styles.content}>
          {vm.stage === "idle"    && renderIdle()}
          {vm.stage === "preview" && renderPreview()}
          {vm.stage === "result"  && renderResult()}
        </div>
      </div>
    </Modal>
  );
}
