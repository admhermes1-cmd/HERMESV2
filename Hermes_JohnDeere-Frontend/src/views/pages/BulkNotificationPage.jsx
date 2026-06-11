import { useRef, useState } from "react";
import {
  Upload,
  Download,
  FileText,
  Send,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Clock,
  Info,
  Layers,
} from "lucide-react";
import { useBulkNotificationViewModel } from "../../viewmodels/useBulkNotificationViewModel";
import Button from "../components/common/Button";
import styles from "./BulkNotificationPage.module.css";

/**
 * Página de envio em massa de notificações via CSV ou JSON.
 *
 * Design: Opção A (claro) — stepper lateral fixo + conteúdo principal à direita.
 * Estrutura visual idêntica ao UserImportModal para consistência visual do sistema.
 *
 * O ViewModel (useBulkNotificationViewModel) não foi alterado.
 * Esta é apenas uma refatoração da camada de apresentação.
 */
export default function BulkNotificationPage() {
  const fileInputRef = useRef(null);

  const vm = useBulkNotificationViewModel();

  const [isDragOver, setIsDragOver] = useState(false);

  // ── File handlers ────────────────────────────────────────────────────────

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileInputChange(e) {
    vm.handleFileChange(e.target.files?.[0] ?? null);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    vm.handleFileChange(e.dataTransfer.files?.[0] ?? null);
  }

  function onDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function onDragLeave() {
    setIsDragOver(false);
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const canDownload = vm.selectedVersion !== null;
  const canSubmit = vm.templateId && vm.file && !vm.isSending;

  // Etapa atual do stepper (0-based)
  const currentStep = vm.result ? 3 : vm.file ? 2 : vm.templateId ? 1 : 0;

  const steps = [
    { label: "Template", desc: "Selecione o template" },
    { label: "Modelo", desc: "Baixe e preencha" },
    { label: "Upload", desc: "Envie o arquivo" },
    { label: "Resultado", desc: "Resumo do envio" },
  ];

  // ── Stepper ──────────────────────────────────────────────────────────────

  const renderStepper = () => (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon} aria-hidden="true">
          <Layers size={17} />
        </div>
        <span className={styles.brandName}>HERMES</span>
      </div>

      <nav className={styles.stepList} aria-label="Etapas do envio em massa">
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          const isPending = i > currentStep;

          return (
            <div key={step.label}>
              <div
                className={[
                  styles.stepItem,
                  isDone ? styles.stepDone : "",
                  isActive ? styles.stepActive : "",
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
                    <span className={styles.stepDesc}>{step.desc}</span>
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

  // ── Resultado ────────────────────────────────────────────────────────────

  if (vm.result) {
    const { result } = vm;
    const allSuccess = result.failed === 0;
    const allFailed = result.successful === 0;

    return (
      <main className={styles.page} aria-label="Resultado do envio em massa">
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Envio em Massa</h1>
          <p className={styles.pageSubtitle}>
            Envie notificações para múltiplos destinatários via CSV ou JSON.
          </p>
        </header>

        <div className={styles.layout}>
          {renderStepper()}

          <div className={styles.content}>
            {/* Banner de status */}
            <div
              className={[
                styles.resultBanner,
                allSuccess
                  ? styles.bannerSuccess
                  : allFailed
                    ? styles.bannerError
                    : styles.bannerWarning,
              ].join(" ")}
            >
              <div className={styles.resultBannerIcon}>
                {allSuccess ? (
                  <CheckCircle2 size={26} aria-hidden="true" />
                ) : allFailed ? (
                  <XCircle size={26} aria-hidden="true" />
                ) : (
                  <AlertCircle size={26} aria-hidden="true" />
                )}
              </div>
              <div>
                <p className={styles.resultBannerTitle}>
                  {allSuccess
                    ? "Todos os envios foram concluídos!"
                    : allFailed
                      ? "Nenhum envio foi concluído"
                      : "Envio concluído com alertas"}
                </p>
                <p className={styles.resultBannerSub}>
                  {result.total} total ·{" "}
                  <strong>
                    {result.successful} sucesso
                    {result.successful !== 1 ? "s" : ""}
                  </strong>
                  {result.failed > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      <strong className={styles.failText}>
                        {result.failed} falha{result.failed !== 1 ? "s" : ""}
                      </strong>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Cards de resumo */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryNum}>{result.total}</span>
                <span className={styles.summaryLbl}>Total</span>
              </div>
              <div className={`${styles.summaryCard} ${styles.summaryCardOk}`}>
                <span className={styles.summaryNum}>{result.successful}</span>
                <span className={styles.summaryLbl}>Enviados</span>
              </div>
              <div
                className={`${styles.summaryCard} ${result.failed > 0 ? styles.summaryCardErr : ""}`}
              >
                <span className={styles.summaryNum}>{result.failed}</span>
                <span className={styles.summaryLbl}>Falhas</span>
              </div>
            </div>

            {/* Tabela de falhas */}
            {result.failures.length > 0 && (
              <div className={styles.resultTable}>
                <div className={styles.resultTableHeader}>
                  <XCircle
                    size={14}
                    aria-hidden="true"
                    className={styles.iconErr}
                  />
                  <span>Falhas ({result.failures.length})</span>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>E-mail</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failures.map((f) => (
                        <tr key={`fail-${f.line}`} className={styles.rowErr}>
                          <td>{f.line}</td>
                          <td>{f.email ?? "—"}</td>
                          <td>{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabela de sucessos */}
            {result.successes.length > 0 && (
              <div className={styles.resultTable}>
                <div className={styles.resultTableHeader}>
                  <CheckCircle2
                    size={14}
                    aria-hidden="true"
                    className={styles.iconOk}
                  />
                  <span>Enviados com sucesso ({result.successes.length})</span>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>E-mail</th>
                        <th>Nome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.successes.map((s) => (
                        <tr key={`ok-${s.line}`} className={styles.rowOk}>
                          <td>{s.line}</td>
                          <td>{s.email}</td>
                          <td>{s.name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ação */}
            <div className={styles.resultActions}>
              <Button
                variant="secondary"
                icon={RotateCcw}
                onClick={vm.handleReset}
              >
                Novo envio em massa
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Formulário ───────────────────────────────────────────────────────────

  return (
    <main className={styles.page} aria-label="Envio em massa de notificações">
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Envio em Massa</h1>
        <p className={styles.pageSubtitle}>
          Envie notificações para múltiplos destinatários via CSV ou JSON.
        </p>
      </header>

      <div className={styles.layout}>
        {renderStepper()}

        <div className={styles.content}>
          {/* Erro global */}
          {vm.error && (
            <div
              className={styles.errorBanner}
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle size={15} aria-hidden="true" />
              <span>{vm.error}</span>
            </div>
          )}

          {/* ── Etapa 1: Template ───────────────────────────────────── */}
          <section className={styles.section} aria-labelledby="step1-title">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionNum}>1</div>
              <div>
                <h2 className={styles.sectionTitle} id="step1-title">
                  Selecione o template
                </h2>
                <p className={styles.sectionDesc}>
                  Escolha o template e a versão a utilizar
                </p>
              </div>
            </div>

            <div className={styles.fieldRow}>
              {/* Template */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="templateId">
                  Template{" "}
                  <span className={styles.required} aria-hidden="true">
                    *
                  </span>
                </label>
                <div className={styles.selectWrap}>
                  <select
                    id="templateId"
                    className={[
                      styles.select,
                      vm.fieldErrors.templateId ? styles.selectErr : "",
                    ].join(" ")}
                    value={vm.templateId}
                    onChange={(e) => vm.handleTemplateChange(e.target.value)}
                    disabled={vm.isLoadingTemplates}
                    aria-busy={vm.isLoadingTemplates}
                    aria-invalid={!!vm.fieldErrors.templateId}
                  >
                    <option value="">
                      {vm.isLoadingTemplates
                        ? "Carregando…"
                        : "Selecione um template"}
                    </option>
                    {vm.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className={styles.selectIcon}
                    size={15}
                    aria-hidden="true"
                  />
                </div>
                {vm.fieldErrors.templateId && (
                  <span className={styles.fieldErr} role="alert">
                    {vm.fieldErrors.templateId}
                  </span>
                )}
              </div>

              {/* Versão */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="templateVersionId">
                  Versão
                </label>
                <div className={styles.selectWrap}>
                  <select
                    id="templateVersionId"
                    className={styles.select}
                    value={vm.templateVersionId}
                    onChange={(e) => vm.handleVersionChange(e.target.value)}
                    disabled={
                      !vm.templateId || vm.availableVersions.length === 0
                    }
                  >
                    <option value="">
                      {!vm.templateId
                        ? "Selecione um template primeiro"
                        : "Versão mais recente (padrão)"}
                    </option>
                    {vm.availableVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNumber}
                        {v.isActive ? " (ativa)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className={styles.selectIcon}
                    size={15}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Variáveis detectadas */}
            {vm.requiredVariables.length > 0 && (
              <div className={styles.varsInfo} role="note">
                <Info size={13} aria-hidden="true" />
                <span>
                  Variáveis do template:{" "}
                  {vm.requiredVariables.map((v) => (
                    <code key={v} className={styles.varChip}>{`{{${v}}}`}</code>
                  ))}{" "}
                  — inclua essas colunas no arquivo.
                </span>
              </div>
            )}
          </section>

          <div className={styles.divider} aria-hidden="true" />

          {/* ── Etapa 2: Download do modelo ─────────────────────────── */}
          <section
            className={[
              styles.section,
              !canDownload ? styles.sectionDisabled : "",
            ].join(" ")}
            aria-labelledby="step2-title"
          >
            <div className={styles.sectionHeader}>
              <div
                className={[
                  styles.sectionNum,
                  !canDownload ? styles.sectionNumDisabled : "",
                ].join(" ")}
              >
                2
              </div>
              <div>
                <h2 className={styles.sectionTitle} id="step2-title">
                  Baixe o modelo de preenchimento
                </h2>
                <p className={styles.sectionDesc}>
                  O arquivo é gerado com as colunas do template selecionado.
                  Preencha e faça upload na próxima etapa.
                </p>
              </div>
            </div>

            <div className={styles.downloadRow}>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={() => vm.handleDownloadTemplate("csv")}
                disabled={!canDownload}
                aria-label="Baixar modelo CSV"
              >
                <Download size={14} aria-hidden="true" />
                Modelo CSV
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={() => vm.handleDownloadTemplate("json")}
                disabled={!canDownload}
                aria-label="Baixar modelo JSON"
              >
                <Download size={14} aria-hidden="true" />
                Modelo JSON
              </button>
            </div>
          </section>

          <div className={styles.divider} aria-hidden="true" />

          {/* ── Etapa 3: Upload ─────────────────────────────────────── */}
          <section className={styles.section} aria-labelledby="step3-title">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionNum}>3</div>
              <div>
                <h2 className={styles.sectionTitle} id="step3-title">
                  Faça o upload do arquivo preenchido
                </h2>
                <p className={styles.sectionDesc}>
                  CSV ou JSON · máx. 5 MB · 200 destinatários
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className={styles.hiddenInput}
              onChange={onFileInputChange}
              aria-hidden="true"
              tabIndex={-1}
            />

            <div
              role="button"
              tabIndex={0}
              aria-label="Clique ou arraste um arquivo CSV ou JSON aqui"
              className={[
                styles.dropZone,
                isDragOver ? styles.dropZoneDrag : "",
                vm.fieldErrors.file ? styles.dropZoneErr : "",
                vm.file ? styles.dropZoneSuccess : "",
              ].join(" ")}
              onClick={openFilePicker}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && openFilePicker()
              }
            >
              {vm.file ? (
                <div className={styles.filePreview}>
                  <FileText
                    size={26}
                    className={styles.fileIcon}
                    aria-hidden="true"
                  />
                  <div>
                    <p className={styles.fileName}>{vm.file.name}</p>
                    <p className={styles.fileSize}>
                      {(vm.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className={styles.dropPrompt}>
                  <Upload size={24} aria-hidden="true" />
                  <p>
                    Arraste o arquivo aqui ou{" "}
                    <span className={styles.dropLink}>
                      clique para selecionar
                    </span>
                  </p>
                  <span className={styles.dropHint}>
                    .csv ou .json · máx. 5 MB · 200 destinatários
                  </span>
                  <div className={styles.formatChips} aria-hidden="true">
                    <span className={styles.chip}>.csv</span>
                    <span className={styles.chip}>.json</span>
                  </div>
                </div>
              )}
            </div>

            {vm.fieldErrors.file && (
              <div className={styles.fieldErrRow} role="alert">
                <AlertCircle size={13} aria-hidden="true" />
                <span>{vm.fieldErrors.file}</span>
              </div>
            )}
          </section>

          <div className={styles.divider} aria-hidden="true" />

          {/* ── Etapa 4: Confirmar e enviar ─────────────────────────── */}
          <section className={styles.section} aria-labelledby="step4-title">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionNum}>4</div>
              <div>
                <h2 className={styles.sectionTitle} id="step4-title">
                  Confirme e envie
                </h2>
                <p className={styles.sectionDesc}>
                  Escolha entre envio imediato ou agendado
                </p>
              </div>
            </div>

            {/* Toggle imediato / agendado */}
            <div className={styles.scheduleToggle}>
              <button
                type="button"
                role="switch"
                aria-checked={!vm.isImmediate}
                className={[
                  styles.toggleBtn,
                  !vm.isImmediate ? styles.toggleActive : "",
                ].join(" ")}
                onClick={vm.handleToggleImmediate}
              >
                <Clock size={14} aria-hidden="true" />
                {vm.isImmediate ? "Envio imediato" : "Agendado"}
              </button>
            </div>

            {!vm.isImmediate && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="scheduledAt">
                  Data e hora de envio{" "}
                  <span className={styles.required} aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  className={[
                    styles.input,
                    vm.fieldErrors.scheduledAt ? styles.inputErr : "",
                  ].join(" ")}
                  value={vm.scheduledAt}
                  onChange={(e) => vm.handleScheduledAtChange(e.target.value)}
                  aria-invalid={!!vm.fieldErrors.scheduledAt}
                />
                {vm.fieldErrors.scheduledAt && (
                  <span className={styles.fieldErr} role="alert">
                    {vm.fieldErrors.scheduledAt}
                  </span>
                )}
              </div>
            )}

            <div className={styles.sendRow}>
              <Button
                variant="primary"
                icon={Send}
                isLoading={vm.isSending}
                disabled={!canSubmit}
                onClick={vm.handleSubmit}
              >
                {vm.isSending
                  ? "Enviando…"
                  : vm.isImmediate
                    ? "Enviar agora"
                    : "Agendar envio"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
