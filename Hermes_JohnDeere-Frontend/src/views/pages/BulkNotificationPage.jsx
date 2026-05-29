import { useRef } from 'react';
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
} from 'lucide-react';
import { useBulkNotificationViewModel } from '../../viewmodels/useBulkNotificationViewModel';
import styles from './BulkNotificationPage.module.css';

/**
 * Página de envio em massa de notificações via CSV ou JSON.
 *
 * Puramente apresentacional — todo o estado e lógica residem em
 * {@link useBulkNotificationViewModel}. O fluxo guia o usuário em etapas:
 * 1. Selecionar template e versão
 * 2. Baixar o template de preenchimento (CSV ou JSON)
 * 3. Fazer upload do arquivo preenchido
 * 4. Confirmar o envio e visualizar o relatório de resultado
 *
 * @component
 * @returns {JSX.Element}
 */
export default function BulkNotificationPage() {
  const fileInputRef = useRef(null);

  const {
    templateId,
    templateVersionId,
    scheduledAt,
    isImmediate,
    file,
    templates,
    selectedTemplate,
    selectedVersion,
    availableVersions,
    requiredVariables,
    isLoadingTemplates,
    isSending,
    result,
    error,
    fieldErrors,
    handleTemplateChange,
    handleVersionChange,
    handleFileChange,
    handleScheduledAtChange,
    handleToggleImmediate,
    handleDownloadTemplate,
    handleSubmit,
    handleReset,
  } = useBulkNotificationViewModel();

  /** Abre o seletor de arquivo nativo ao clicar na zona de drop. */
  function openFilePicker() {
    fileInputRef.current?.click();
  }

  /** Processa o arquivo recebido pelo input nativo. */
  function onFileInputChange(e) {
    handleFileChange(e.target.files?.[0] ?? null);
    // Limpa o value para permitir re-upload do mesmo arquivo
    e.target.value = '';
  }

  /** Processa arquivo arrastado para a zona de drop. */
  function onDrop(e) {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  const hasResult   = result !== null;
  const canDownload = selectedVersion !== null;
  const canSubmit   = templateId && file && !isSending;

  return (
    <main className={styles.page} aria-label="Envio em massa de notificações">
      <header className={styles.header}>
        <h1 className={styles.title}>Envio em Massa</h1>
        <p className={styles.subtitle}>
          Envie notificações para múltiplos destinatários de uma vez via CSV ou JSON.
        </p>
      </header>

      {/* ── Resultado ──────────────────────────────────────────────────────── */}
      {hasResult && (
        <section className={styles.resultSection} aria-label="Resultado do envio em massa">
          <ResultSummary result={result} onReset={handleReset} />
        </section>
      )}

      {/* ── Formulário ─────────────────────────────────────────────────────── */}
      {!hasResult && (
        <div className={styles.formWrapper}>

          {/* Erro global */}
          {error && (
            <div className={styles.globalError} role="alert" aria-live="assertive">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Etapa 1: Template ──────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="step-template-title">
            <StepBadge number={1} />
            <h2 className={styles.cardTitle} id="step-template-title">
              Selecione o template
            </h2>

            <div className={styles.fieldRow}>
              {/* Template */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="templateId">
                  Template <span className={styles.required} aria-hidden="true">*</span>
                </label>
                <div className={styles.selectWrapper}>
                  <select
                    id="templateId"
                    className={styles.select}
                    value={templateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    disabled={isLoadingTemplates}
                    aria-busy={isLoadingTemplates}
                    aria-invalid={!!fieldErrors.templateId}
                    aria-describedby={fieldErrors.templateId ? 'err-templateId' : undefined}
                  >
                    <option value="">
                      {isLoadingTemplates ? 'Carregando templates…' : 'Selecione um template'}
                    </option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className={styles.selectIcon} size={16} aria-hidden="true" />
                </div>
                {fieldErrors.templateId && (
                  <span id="err-templateId" className={styles.fieldError} role="alert">
                    {fieldErrors.templateId}
                  </span>
                )}
              </div>

              {/* Versão */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="templateVersionId">
                  Versão
                </label>
                <div className={styles.selectWrapper}>
                  <select
                    id="templateVersionId"
                    className={styles.select}
                    value={templateVersionId}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    disabled={!templateId || availableVersions.length === 0}
                  >
                    <option value="">
                      {!templateId ? 'Selecione um template primeiro' : 'Versão mais recente (padrão)'}
                    </option>
                    {availableVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNumber}{v.isActive ? ' (ativa)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={styles.selectIcon} size={16} aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Variáveis detectadas */}
            {requiredVariables.length > 0 && (
              <div className={styles.variablesInfo} role="note" aria-label="Variáveis do template">
                <Info size={14} aria-hidden="true" />
                <span>
                  Variáveis do template:{' '}
                  {requiredVariables.map((v, i) => (
                    <span key={v} className={styles.variableChip}>
                      {`{{${v}}}`}{i < requiredVariables.length - 1 ? '' : ''}
                    </span>
                  ))}
                  {' '}— inclua essas colunas no arquivo.
                </span>
              </div>
            )}
          </section>

          {/* ── Etapa 2: Download do template ─────────────────────────────── */}
          <section
            className={`${styles.card} ${!canDownload ? styles.cardDisabled : ''}`}
            aria-labelledby="step-download-title"
          >
            <StepBadge number={2} disabled={!canDownload} />
            <h2 className={styles.cardTitle} id="step-download-title">
              Baixe o modelo de preenchimento
            </h2>
            <p className={styles.cardDescription}>
              O arquivo é gerado dinamicamente com as colunas do template selecionado.
              Preencha e faça upload na etapa seguinte.
            </p>
            <div className={styles.downloadButtons}>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={() => handleDownloadTemplate('csv')}
                disabled={!canDownload}
                aria-disabled={!canDownload}
                aria-label="Baixar modelo CSV"
              >
                <Download size={16} aria-hidden="true" />
                Modelo CSV
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={() => handleDownloadTemplate('json')}
                disabled={!canDownload}
                aria-disabled={!canDownload}
                aria-label="Baixar modelo JSON"
              >
                <Download size={16} aria-hidden="true" />
                Modelo JSON
              </button>
            </div>
          </section>

          {/* ── Etapa 3: Upload ───────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="step-upload-title">
            <StepBadge number={3} />
            <h2 className={styles.cardTitle} id="step-upload-title">
              Faça o upload do arquivo preenchido
            </h2>

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
              className={`${styles.dropZone} ${fieldErrors.file ? styles.dropZoneError : ''} ${file ? styles.dropZoneSuccess : ''}`}
              onClick={openFilePicker}
              onDrop={onDrop}
              onDragOver={onDragOver}
              role="button"
              tabIndex={0}
              aria-label="Clique ou arraste um arquivo CSV ou JSON aqui"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openFilePicker()}
            >
              {file ? (
                <div className={styles.fileSelected}>
                  <FileText size={24} className={styles.fileIcon} aria-hidden="true" />
                  <div>
                    <p className={styles.fileName}>{file.name}</p>
                    <p className={styles.fileSize}>
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className={styles.dropZonePlaceholder}>
                  <Upload size={24} aria-hidden="true" />
                  <p>Clique ou arraste o arquivo aqui</p>
                  <span>.csv ou .json · máx. 5 MB · 200 destinatários</span>
                </div>
              )}
            </div>

            {fieldErrors.file && (
              <span className={styles.fieldError} role="alert" aria-live="polite">
                <AlertCircle size={13} aria-hidden="true" />
                {fieldErrors.file}
              </span>
            )}
          </section>

          {/* ── Etapa 4: Agendamento + Envio ──────────────────────────────── */}
          <section className={styles.card} aria-labelledby="step-send-title">
            <StepBadge number={4} />
            <h2 className={styles.cardTitle} id="step-send-title">
              Confirme e envie
            </h2>

            {/* Toggle imediato / agendado */}
            <div className={styles.scheduleToggle}>
              <button
                type="button"
                role="switch"
                aria-checked={!isImmediate}
                className={`${styles.toggleBtn} ${!isImmediate ? styles.toggleBtnActive : ''}`}
                onClick={handleToggleImmediate}
                aria-label="Alternar entre envio imediato e agendado"
              >
                <Clock size={14} aria-hidden="true" />
                {isImmediate ? 'Envio imediato' : 'Agendado'}
              </button>
            </div>

            {!isImmediate && (
              <div className={styles.field} style={{ marginTop: 'var(--space-3)' }}>
                <label className={styles.label} htmlFor="scheduledAt">
                  Data e hora de envio <span className={styles.required} aria-hidden="true">*</span>
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  className={styles.input}
                  value={scheduledAt}
                  onChange={(e) => handleScheduledAtChange(e.target.value)}
                  aria-invalid={!!fieldErrors.scheduledAt}
                  aria-describedby={fieldErrors.scheduledAt ? 'err-scheduledAt' : undefined}
                />
                {fieldErrors.scheduledAt && (
                  <span id="err-scheduledAt" className={styles.fieldError} role="alert">
                    {fieldErrors.scheduledAt}
                  </span>
                )}
              </div>
            )}

            <div className={styles.sendActions}>
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
                aria-busy={isSending}
              >
                {isSending ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send size={16} aria-hidden="true" />
                    {isImmediate ? 'Enviar agora' : 'Agendar envio'}
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes internos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Badge numérico de etapa.
 *
 * @param {{ number: number, disabled?: boolean }} props
 */
function StepBadge({ number, disabled = false }) {
  return (
    <span
      className={`${styles.stepBadge} ${disabled ? styles.stepBadgeDisabled : ''}`}
      aria-label={`Etapa ${number}`}
    >
      {number}
    </span>
  );
}

/**
 * Seção de resultado exibida após o processamento do envio em massa.
 *
 * @param {{ result: import('../../dto/notification/BulkNotificationResultDTO').BulkNotificationResultDTO, onReset: () => void }} props
 */
function ResultSummary({ result, onReset }) {
  const allSuccess = result.failed === 0;
  const allFailed  = result.successful === 0;

  return (
    <div className={styles.result}>
      {/* Resumo */}
      <div className={`${styles.resultHeader} ${allFailed ? styles.resultHeaderFailed : allSuccess ? styles.resultHeaderSuccess : styles.resultHeaderPartial}`}>
        <div className={styles.resultIcon}>
          {allSuccess
            ? <CheckCircle2 size={28} aria-hidden="true" />
            : allFailed
              ? <XCircle size={28} aria-hidden="true" />
              : <AlertCircle size={28} aria-hidden="true" />
          }
        </div>
        <div>
          <h2 className={styles.resultTitle}>
            {allSuccess
              ? 'Todos os envios foram concluídos!'
              : allFailed
                ? 'Nenhum envio foi concluído'
                : 'Envio concluído com alertas'
            }
          </h2>
          <p className={styles.resultSubtitle} aria-live="polite">
            {result.total} total ·{' '}
            <strong className={styles.successCount}>{result.successful} sucesso{result.successful !== 1 ? 's' : ''}</strong>
            {result.failed > 0 && (
              <> · <strong className={styles.failCount}>{result.failed} falha{result.failed !== 1 ? 's' : ''}</strong></>
            )}
          </p>
        </div>
      </div>

      {/* Tabela de falhas */}
      {result.failures.length > 0 && (
        <div className={styles.failuresSection}>
          <h3 className={styles.failuresTitle}>
            <XCircle size={15} aria-hidden="true" />
            Falhas ({result.failures.length})
          </h3>
          <div className={styles.tableWrapper} role="region" aria-label="Lista de falhas">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Linha</th>
                  <th className={styles.th}>E-mail</th>
                  <th className={styles.th}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {result.failures.map((f) => (
                  <tr key={`fail-${f.line}`} className={styles.trFail}>
                    <td className={styles.td}>{f.line}</td>
                    <td className={styles.td}>{f.email ?? '—'}</td>
                    <td className={styles.td}>{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela de sucessos */}
      {result.successes.length > 0 && (
        <div className={styles.successesSection}>
          <h3 className={styles.successesTitle}>
            <CheckCircle2 size={15} aria-hidden="true" />
            Enviados com sucesso ({result.successes.length})
          </h3>
          <div className={styles.tableWrapper} role="region" aria-label="Lista de envios bem-sucedidos">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Linha</th>
                  <th className={styles.th}>E-mail</th>
                  <th className={styles.th}>Nome</th>
                </tr>
              </thead>
              <tbody>
                {result.successes.map((s) => (
                  <tr key={`ok-${s.line}`} className={styles.trSuccess}>
                    <td className={styles.td}>{s.line}</td>
                    <td className={styles.td}>{s.email}</td>
                    <td className={styles.td}>{s.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ação */}
      <div className={styles.resultActions}>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={onReset}
          aria-label="Realizar novo envio em massa"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Novo envio em massa
        </button>
      </div>
    </div>
  );
}
