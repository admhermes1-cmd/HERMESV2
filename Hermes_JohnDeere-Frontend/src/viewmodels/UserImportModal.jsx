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
import { useUserImportViewModel } from "./useUserImportViewModel";
import Modal from "../views/components/common/Modal";
import Button from "../views/components/common/Button";
import styles from "./UserImportModal.module.css";

/**
 * @typedef {Object} UserImportModalProps
 * @property {boolean}  isOpen      - Controla a visibilidade do modal
 * @property {Function} onClose     - Callback disparado ao fechar o modal
 * @property {Function} [onSuccess] - Callback opcional chamado após importação com ao menos 1 sucesso
 */

/**
 * Modal de importação em massa de usuários via CSV ou JSON.
 *
 * Apresenta duas etapas:
 * 1. **Seleção de arquivo** — drop zone + input file, com validação client-side
 * 2. **Resultado** — resumo consolidado com lista expansível de falhas por linha
 *
 * Toda lógica de estado, validação e requisição HTTP vive em {@link useUserImportViewModel}.
 * Este componente é uma View pura: apenas renderiza e delega eventos ao ViewModel.
 *
 * Localização: src/views/components/UserImportModal.jsx
 *
 * @param {UserImportModalProps} props
 */
export default function UserImportModal({ isOpen, onClose, onSuccess }) {
  const {
    selectedFile,
    isLoading,
    error,
    result,
    stage,
    handleFileSelect,
    handleDrop,
    handleImport,
    handleReset,
    cancel,
  } = useUserImportViewModel();

  const fileInputRef                    = useRef(null);
  const [isDragOver, setIsDragOver]     = useState(false);
  const [failuresOpen, setFailuresOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Drag handlers (UI-only state)
  // ---------------------------------------------------------------------------

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const onDrop = useCallback(
    (e) => {
      setIsDragOver(false);
      handleDrop(e);
    },
    [handleDrop]
  );

  // ---------------------------------------------------------------------------
  // Close / finish
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    cancel();
    handleReset();
    onClose();
  };

  const handleFinish = () => {
    if (result?.successCount > 0) onSuccess?.();
    handleClose();
  };

  // ---------------------------------------------------------------------------
  // Template download (client-side, sem request ao servidor)
  // ---------------------------------------------------------------------------

  const downloadCsvTemplate = () => {
    const content = [
      "name,email,role,password",
      "João Silva,joao@empresa.com,USER,",
      "Maria Souza,maria@empresa.com,MANAGER,senha123",
    ].join("\n");
    triggerDownload(content, "template_usuarios.csv", "text/csv;charset=utf-8;");
  };

  const downloadJsonTemplate = () => {
    const content = JSON.stringify(
      [
        { name: "João Silva",  email: "joao@empresa.com",  role: "USER",    password: "" },
        { name: "Maria Souza", email: "maria@empresa.com", role: "MANAGER", password: "senha123" },
      ],
      null,
      2
    );
    triggerDownload(content, "template_usuarios.json", "application/json");
  };

  const triggerDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderHeader = () => (
    <div className={styles.header}>
      <div className={styles.headerIcon}>
        <Users size={20} aria-hidden="true" />
      </div>
      <div className={styles.headerText}>
        <h2 className={styles.title}>
          {stage === "result" ? "Resultado da Importação" : "Importar Usuários em Massa"}
        </h2>
        <p className={styles.subtitle}>
          {stage === "result"
            ? "Confira o resumo da operação abaixo"
            : "Envie um arquivo .csv ou .json com os dados dos usuários"}
        </p>
      </div>
    </div>
  );

  const renderUploadStage = () => (
    <div className={styles.uploadStage}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Área de arrastar e soltar arquivo. Clique para selecionar."
        className={[
          styles.dropZone,
          isDragOver    ? styles.dropZoneDragOver : "",
          selectedFile  ? styles.dropZoneHasFile  : "",
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
          className={styles.fileInput}
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleFileSelect}
        />

        {selectedFile ? (
          <div className={styles.filePreview}>
            <FileText size={28} className={styles.fileIcon} aria-hidden="true" />
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{selectedFile.name}</span>
              <span className={styles.fileSize}>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.dropPrompt}>
            <Upload size={28} className={styles.uploadIcon} aria-hidden="true" />
            <p className={styles.dropText}>
              Arraste seu arquivo aqui ou{" "}
              <span className={styles.dropLink}>clique para selecionar</span>
            </p>
            <p className={styles.dropHint}>CSV ou JSON · Máximo 5 MB</p>
          </div>
        )}
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div role="alert" className={styles.errorBanner}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Templates para download */}
      <div className={styles.templates}>
        <p className={styles.templatesLabel}>Baixar modelo:</p>
        <div className={styles.templateButtons}>
          <button
            type="button"
            className={styles.templateBtn}
            onClick={downloadCsvTemplate}
            aria-label="Baixar modelo CSV"
          >
            <Download size={13} aria-hidden="true" />
            template.csv
          </button>
          <button
            type="button"
            className={styles.templateBtn}
            onClick={downloadJsonTemplate}
            aria-label="Baixar modelo JSON"
          >
            <Download size={13} aria-hidden="true" />
            template.json
          </button>
        </div>
      </div>

      {/* Legenda de colunas */}
      <div className={styles.legend}>
        <p className={styles.legendTitle}>Colunas esperadas</p>
        <div className={styles.legendGrid}>
          {[
            { col: "name",     req: true,  desc: "Nome completo" },
            { col: "email",    req: true,  desc: "E-mail único" },
            { col: "role",     req: true,  desc: "USER, MANAGER ou ADMIN" },
            { col: "password", req: false, desc: "Opcional — gerada se vazia" },
          ].map(({ col, req, desc }) => (
            <div key={col} className={styles.legendRow}>
              <code className={styles.legendCode}>{col}</code>
              {req
                ? <span className={styles.legendRequired}>obrigatório</span>
                : <span className={styles.legendOptional}>opcional</span>}
              <span className={styles.legendDesc}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderResultStage = () => {
    if (!result) return null;
    const hasFailures = result.failureCount > 0;
    const hasSuccess  = result.successCount > 0;

    return (
      <div className={styles.resultStage} role="region" aria-label="Resultado da importação">
        {/* Cartões de resumo */}
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryNumber}>{result.totalRows}</span>
            <span className={styles.summaryLabel}>Total de linhas</span>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardSuccess}`}>
            <span className={styles.summaryNumber}>{result.successCount}</span>
            <span className={styles.summaryLabel}>Criados</span>
          </div>
          <div className={`${styles.summaryCard} ${hasFailures ? styles.summaryCardError : ""}`}>
            <span className={styles.summaryNumber}>{result.failureCount}</span>
            <span className={styles.summaryLabel}>Falhas</span>
          </div>
        </div>

        {/* Banner de status global */}
        {hasSuccess && !hasFailures && (
          <div role="status" className={`${styles.statusBanner} ${styles.statusBannerSuccess}`}>
            <CheckCircle size={16} aria-hidden="true" />
            <span>Todos os usuários foram importados com sucesso!</span>
          </div>
        )}
        {hasSuccess && hasFailures && (
          <div role="status" className={`${styles.statusBanner} ${styles.statusBannerWarning}`}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              Importação parcial: {result.successCount} criado(s),{" "}
              {result.failureCount} com falha(s).
            </span>
          </div>
        )}
        {!hasSuccess && hasFailures && (
          <div role="alert" className={`${styles.statusBanner} ${styles.statusBannerError}`}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>Nenhum usuário foi importado. Corrija os erros e tente novamente.</span>
          </div>
        )}

        {/* Lista de falhas expansível */}
        {hasFailures && (
          <div className={styles.failuresSection}>
            <button
              type="button"
              className={styles.failuresToggle}
              onClick={() => setFailuresOpen((v) => !v)}
              aria-expanded={failuresOpen}
              aria-controls="failures-list"
            >
              <AlertCircle size={14} aria-hidden="true" />
              <span>Ver {result.failureCount} linha(s) com erro</span>
              {failuresOpen
                ? <ChevronUp size={14} aria-hidden="true" />
                : <ChevronDown size={14} aria-hidden="true" />}
            </button>

            {failuresOpen && (
              <ul
                id="failures-list"
                className={styles.failuresList}
                aria-label="Lista de erros por linha"
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

  const renderFooter = () => {
    if (stage === "result") {
      return (
        <div className={styles.footer}>
          <Button
            variant="ghost"
            onClick={handleReset}
            aria-label="Importar outro arquivo"
            icon={<RotateCcw size={15} />}
          >
            Importar outro
          </Button>
          <Button variant="primary" onClick={handleFinish}>
            Concluir
          </Button>
        </div>
      );
    }

    return (
      <div className={styles.footer}>
        <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!selectedFile || isLoading}
          loading={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? "Importando…" : "Importar Usuários"}
        </Button>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      aria-label="Modal de importação em massa de usuários"
    >
      <div className={styles.container}>
        {renderHeader()}
        <div className={styles.body}>
          {stage === "idle"   && renderUploadStage()}
          {stage === "result" && renderResultStage()}
        </div>
        {renderFooter()}
      </div>
    </Modal>
  );
}