/**
 * @file TemplateFormPage.jsx
 * @description Página de criação e edição de Templates do sistema HERMES.
 *
 * Opera em dois modos distintos:
 *  - **Criação** (`/templates/new`): fluxo sequencial em 2 etapas.
 *    - Etapa 1: Nome + Descrição. Botão "Continuar" habilita ao preencher Nome.
 *    - Etapa 2: Editor de versão (Subject + Body + variáveis). Botão "Salvar Template"
 *      chama `handleCreateWithVersion` — persiste metadados e versão atomicamente.
 *  - **Edição** (`/templates/:id/edit`): layout em duas colunas, comportamento preservado.
 *    - Coluna esquerda: metadados (nome, descrição, canal read-only como Badge).
 *    - Coluna direita: editor de versões com "Nova Versão" e "Salvar Versão".
 *    - Botão "Salvar Template" (metadados) está na coluna direita, abaixo do editor,
 *      para eliminar ambiguidade visual entre os dois botões de salvar.
 *
 * Canal de envio:
 *  - Em criação: oculto da UI; valor padrão EMAIL vem do ViewModel (EMPTY_FORM).
 *  - Em edição: exibido como Badge read-only (sem select).
 *  - O código do select e das constantes de canal é mantido intacto para expansão futura.
 *
 * @dependencies
 *  - `useTemplateFormViewModel` — toda a lógica de negócio (form, versões, ações).
 *  - `useNavigate` (react-router-dom) — navegação pós-submit.
 *  - `useAuth` (core/auth) — dados do usuário autenticado.
 *  - Componentes comuns: Button, InputField, Badge, LoadingSpinner.
 *  - Componente de template: TemplateVersionSelector.
 *  - Constantes: ROUTES, UI (appConstants).
 *  - Ícones: lucide-react.
 *
 * @security O painel de Preview usa `dangerouslySetInnerHTML` para renderizar o body HTML
 * das versões. O conteúdo renderizado é de autoria do próprio usuário autenticado (editor
 * de template interno). Não há sanitização de HTML de terceiros neste ponto — se o sistema
 * for expandido para receber conteúdo externo, aplicar DOMPurify antes da renderização.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Save, Tag, FileText,
  Code, Eye, AlertCircle, CheckCircle2, Copy,
  ArrowRight, ChevronLeft,
} from 'lucide-react';

import { useTemplateFormViewModel } from '../../viewmodels/useTemplateFormViewModel';
import { useAuth } from '../../core/auth/useAuth';
import { ROUTES, UI } from '../../core/constants/appConstants';
import { TemplateChannel } from '../../models/Template';

import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import TemplateVersionSelector from '../components/template/TemplateVersionSelector';

import styles from './TemplateFormPage.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

// CANAL — constantes mantidas intactas para expansão futura SMS/WhatsApp
const CHANNEL_OPTIONS = [
  { value: TemplateChannel.EMAIL,    label: 'E-mail'   },
  { value: TemplateChannel.SMS,      label: 'SMS'      },
  { value: TemplateChannel.WHATSAPP, label: 'WhatsApp' },
];

/** Retorna true se a string contiver ao menos uma tag HTML. */
function containsHtml(str = '') {
  return /<[a-z][\s\S]*>/i.test(str);
}

// ─── Sub-componentes internos ────────────────────────────────────────────────

/**
 * Chip de variável detectada com botão de cópia para clipboard.
 * @param {{ variable: string }} props
 */
function VariableChip({ variable }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`{{${variable}}}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard não disponível — silencioso */
    }
  };

  return (
    <span className={styles.variableChip}>
      <span className={styles.variableChipName}>{`{{${variable}}}`}</span>
      <button
        type="button"
        className={styles.variableChipCopy}
        onClick={handleCopy}
        aria-label={`Copiar variável ${variable}`}
        title={copied ? 'Copiado!' : `Copiar {{${variable}}}`}
      >
        {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}

/**
 * Indicador de progresso discreto para o fluxo em etapas (modo criação).
 * @param {{ current: number, total: number, labels: string[] }} props
 */
function StepIndicator({ current, total, labels }) {
  return (
    <div className={styles.stepIndicator} aria-label={`Etapa ${current} de ${total}`}>
      {labels.map((label, index) => {
        const step = index + 1;
        const isActive = step === current;
        const isDone   = step < current;
        return (
          <div
            key={label}
            className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''} ${isDone ? styles.stepItemDone : ''}`}
          >
            <span
              className={`${styles.stepDot} ${isActive ? styles.stepDotActive : ''} ${isDone ? styles.stepDotDone : ''}`}
              aria-hidden="true"
            />
            <span className={styles.stepLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function TemplateFormPage() {
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const { user } = useAuth();

  const {
    form,
    versions,
    selectedVersion,
    extractedVariables,
    isLoading,
    isSaving,
    error,
    isEditMode,
    handleChange,
    handleSubmit,
    handleVersionChange,
    handleVersionFieldChange,
    handleAddVersion,
    handleSaveVersion,
    handleCreateWithVersion,
  } = useTemplateFormViewModel();

  /** Aba ativa no editor de body: 'edit' | 'preview' */
  const [bodyTab, setBodyTab] = useState('edit');

  /**
   * Etapa atual do fluxo de criação: 1 (informações) | 2 (conteúdo).
   * Usado apenas em modo criação; ignorado em modo edição.
   */
  const [currentStep, setCurrentStep] = useState(1);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBack = () => navigate(ROUTES.TEMPLATES);

  /** Avança da Etapa 1 para Etapa 2 (sem chamada à API). */
  const handleContinueToStep2 = () => {
    if (!form.name.trim()) return;
    // Garante que exista uma versão draft para editar na etapa 2
    if (versions.length === 0) handleAddVersion();
    setCurrentStep(2);
  };

  /** Retorna da Etapa 2 para Etapa 1 sem perder dados. */
  const handleBackToStep1 = () => setCurrentStep(1);

  /** Salva template + versão atomicamente (criação) e navega para lista. */
  const handleCreateSubmit = async () => {
    const ok = await handleCreateWithVersion();
    if (ok) navigate(ROUTES.TEMPLATES);
  };

  /** Salva apenas metadados do template (edição) e navega para lista. */
  const handleEditSubmit = async () => {
    const ok = await handleSubmit();
    if (ok) navigate(ROUTES.TEMPLATES);
  };

  /** Salva a versão selecionada (edição — nova versão adicionada). */
  const handleSaveSelectedVersion = async () => {
    if (!selectedVersion) return;
    await handleSaveVersion(selectedVersion.id);
  };

  // ── Derivados ─────────────────────────────────────────────────────────────

  const CHANNEL_BADGE_MAP = { EMAIL: 'info', SMS: 'warning', WHATSAPP: 'success' };
  const channelBadgeVariant = CHANNEL_BADGE_MAP[form.channel] ?? 'info';

  const channelLabel = UI.CHANNEL_LABEL?.[form.channel]
    ?? CHANNEL_OPTIONS.find(o => o.value === form.channel)?.label
    ?? form.channel;

  const bodyIsHtml = containsHtml(selectedVersion?.body ?? '');

  const canContinue    = form.name.trim().length > 0;
  const canSaveCreate  = Boolean(selectedVersion?.body?.trim());

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          aria-label="Voltar para lista de templates"
        >
          <ArrowLeft size={18} />
          <span>Voltar</span>
        </button>

        <div className={styles.headerTitle}>
          <h1 className={styles.title}>
            {isEditMode ? 'Editar Template' : 'Novo Template'}
          </h1>
          {isEditMode && form.name && (
            <p className={styles.subtitle}>{form.name}</p>
          )}
        </div>

        {/* Indicador de etapas — somente modo criação */}
        {!isEditMode && (
          <StepIndicator
            current={currentStep}
            total={2}
            labels={['Informações', 'Conteúdo']}
          />
        )}
      </header>

      {/* ── Banner de erro global ───────────────────────────────────────── */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading inicial ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className={styles.loadingArea}>
          <LoadingSpinner />
        </div>
      ) : isEditMode ? (

        /* ═══════════════════════════════════════════════════════════════
           MODO EDIÇÃO — Layout duas colunas (comportamento preservado)
        ═══════════════════════════════════════════════════════════════ */
        <div className={styles.layout}>

          {/* Coluna esquerda — Metadados */}
          <section className={styles.column} aria-label="Metadados do template">
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FileText size={18} aria-hidden="true" />
                <h2 className={styles.cardTitle}>Informações do Template</h2>
              </div>

              <fieldset className={styles.fieldset}>
                <legend className={styles.srOnly}>Dados gerais</legend>

                <InputField
                  label="Nome do Template"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ex: Boas-vindas ao cliente"
                  required
                />

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="template-description">
                    Descrição
                  </label>
                  <textarea
                    id="template-description"
                    className={styles.textarea}
                    name="description"
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Descreva brevemente a finalidade deste template…"
                    rows={3}
                  />
                </div>

                {/* Canal — read-only em edição */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Canal de envio</label>
                  <div className={styles.channelReadOnly}>
                    <Badge label={channelLabel} variant={channelBadgeVariant} />
                    <p className={styles.channelHint}>
                      O canal não pode ser alterado após a criação.
                    </p>
                  </div>
                </div>

                {/* CANAL — select oculto temporariamente, expansão futura SMS/WhatsApp */}
              </fieldset>
            </div>
          </section>

          {/* Coluna direita — Editor de versões + Salvar Template */}
          <section className={styles.column} aria-label="Editor de versões">
            <div className={styles.card}>

              <div className={`${styles.cardHeader} ${styles.cardHeaderSpaced}`}>
                <div className={styles.cardHeaderLeft}>
                  <Copy size={18} aria-hidden="true" />
                  <h2 className={styles.cardTitle}>Versões</h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAddVersion}
                  aria-label="Adicionar nova versão"
                >
                  <Plus size={15} aria-hidden="true" />
                  Nova Versão
                </Button>
              </div>

              {versions.length > 0 && (
                <TemplateVersionSelector
                  versions={versions}
                  selectedId={selectedVersion?.id}
                  onChange={handleVersionChange}
                />
              )}

              {selectedVersion ? (
                <div className={styles.versionEditor}>

                  {form.channel === TemplateChannel.EMAIL && (
                    <InputField
                      label="Assunto"
                      name="subject"
                      type="text"
                      value={selectedVersion.subject ?? ''}
                      onChange={(e) => handleVersionFieldChange('subject', e.target.value)}
                      placeholder="Assunto do e-mail…"
                    />
                  )}

                  <div className={styles.fieldGroup}>
                    <div className={styles.tabBar} role="tablist" aria-label="Modo de edição do corpo">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={bodyTab === 'edit'}
                        className={`${styles.tab} ${bodyTab === 'edit' ? styles.tabActive : ''}`}
                        onClick={() => setBodyTab('edit')}
                        aria-controls="panel-edit-e"
                        id="tab-edit-e"
                      >
                        <Code size={14} aria-hidden="true" />
                        Edição
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={bodyTab === 'preview'}
                        className={`${styles.tab} ${bodyTab === 'preview' ? styles.tabActive : ''}`}
                        onClick={() => setBodyTab('preview')}
                        aria-controls="panel-preview-e"
                        id="tab-preview-e"
                      >
                        <Eye size={14} aria-hidden="true" />
                        Preview
                      </button>
                    </div>

                    <div id="panel-edit-e" role="tabpanel" aria-labelledby="tab-edit-e" hidden={bodyTab !== 'edit'}>
                      <label className={styles.srOnly} htmlFor="version-body-e">Corpo da mensagem</label>
                      <textarea
                        id="version-body-e"
                        className={`${styles.textarea} ${styles.textareaBody}`}
                        value={selectedVersion.body ?? ''}
                        onChange={(e) => handleVersionFieldChange('body', e.target.value)}
                        placeholder="Digite o corpo da mensagem. Use {{variavel}} para inserir variáveis dinâmicas…"
                        rows={10}
                        aria-label="Corpo da versão do template"
                      />
                    </div>

                    <div id="panel-preview-e" role="tabpanel" aria-labelledby="tab-preview-e" hidden={bodyTab !== 'preview'}>
                      {bodyIsHtml ? (
                        /* eslint-disable-next-line react/no-danger */
                        <div
                          className={styles.bodyPreview}
                          dangerouslySetInnerHTML={{ __html: selectedVersion.body }}
                          aria-label="Preview do corpo HTML"
                        />
                      ) : (
                        <pre className={`${styles.bodyPreview} ${styles.bodyPreviewText}`}>
                          {selectedVersion.body || (
                            <span className={styles.previewEmpty}>Nenhum conteúdo para exibir.</span>
                          )}
                        </pre>
                      )}
                    </div>
                  </div>

                  <div className={styles.variablesPanel} aria-label="Variáveis detectadas">
                    <div className={styles.variablesPanelHeader}>
                      <Tag size={15} aria-hidden="true" />
                      <span className={styles.variablesPanelTitle}>Variáveis detectadas</span>
                    </div>
                    <div className={styles.variablesList} aria-live="polite" aria-atomic="true">
                      {extractedVariables.length === 0 ? (
                        <p className={styles.variablesEmpty}>
                          Nenhuma variável detectada. Use{' '}
                          <code className={styles.inlineCode}>{'{{nome_da_variavel}}'}</code>{' '}
                          no corpo da mensagem.
                        </p>
                      ) : (
                        extractedVariables.map((variable) => (
                          <VariableChip key={variable} variable={variable} />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Salvar versão (nova versão em edição) */}
                  <div className={styles.versionActions}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSaveSelectedVersion}
                      aria-label={`Salvar versão ${selectedVersion.versionNumber}`}
                    >
                      <Save size={15} aria-hidden="true" />
                      Salvar Versão
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={styles.noVersionHint}>
                  Nenhuma versão selecionada. Clique em{' '}
                  <strong>Nova Versão</strong> para começar.
                </p>
              )}

              {/* Salvar metadados do template — edição */}
              <div className={styles.editSaveArea}>
                <Button
                  type="button"
                  variant="primary"
                  isLoading={isSaving}
                  onClick={handleEditSubmit}
                  aria-label="Salvar alterações do template"
                >
                  <Save size={16} aria-hidden="true" />
                  Salvar Template
                </Button>
              </div>

            </div>
          </section>
        </div>

      ) : (

        /* ═══════════════════════════════════════════════════════════════
           MODO CRIAÇÃO — Fluxo em etapas
        ═══════════════════════════════════════════════════════════════ */
        <div className={styles.creationFlow}>

          {/* ── Etapa 1 — Informações básicas ─────────────────────────── */}
          {currentStep === 1 && (
            <div className={styles.stepCard} aria-label="Etapa 1 de 2: Informações do template">
              <div className={styles.cardHeader}>
                <FileText size={18} aria-hidden="true" />
                <h2 className={styles.cardTitle}>Informações do Template</h2>
              </div>

              <fieldset className={styles.fieldset}>
                <legend className={styles.srOnly}>Dados gerais</legend>

                <InputField
                  label="Nome do Template"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ex: Boas-vindas ao cliente"
                  required
                />

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="template-description-c">
                    Descrição
                    <span className={styles.optionalTag}> (opcional)</span>
                  </label>
                  <textarea
                    id="template-description-c"
                    className={styles.textarea}
                    name="description"
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Descreva brevemente a finalidade deste template…"
                    rows={3}
                  />
                </div>

                {/* CANAL — oculto temporariamente, expansão futura SMS/WhatsApp */}
                {/*
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="template-channel-c">Canal de envio</label>
                  <select
                    id="template-channel-c"
                    className={styles.select}
                    value={form.channel}
                    onChange={(e) => handleChange('channel', e.target.value)}
                    aria-label="Selecionar canal de envio"
                  >
                    <option value="" disabled>Selecione um canal…</option>
                    {CHANNEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                */}
              </fieldset>

              <div className={styles.stepActions}>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canContinue}
                  onClick={handleContinueToStep2}
                  aria-label="Continuar para edição do conteúdo"
                  aria-disabled={!canContinue}
                >
                  Continuar
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Etapa 2 — Corpo do template ───────────────────────────── */}
          {currentStep === 2 && (
            <div className={styles.stepCard} aria-label="Etapa 2 de 2: Conteúdo do template">
              <div className={`${styles.cardHeader} ${styles.cardHeaderSpaced}`}>
                <div className={styles.cardHeaderLeft}>
                  <Copy size={18} aria-hidden="true" />
                  <h2 className={styles.cardTitle}>Conteúdo do Template</h2>
                </div>
                <button
                  type="button"
                  className={styles.backStepButton}
                  onClick={handleBackToStep1}
                  aria-label="Voltar para etapa de informações"
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                  Voltar
                </button>
              </div>

              {selectedVersion && (
                <div className={styles.versionEditor}>

                  {/* Assunto — apenas EMAIL */}
                  {form.channel === TemplateChannel.EMAIL && (
                    <InputField
                      label="Assunto"
                      name="subject"
                      type="text"
                      value={selectedVersion.subject ?? ''}
                      onChange={(e) => handleVersionFieldChange('subject', e.target.value)}
                      placeholder="Assunto do e-mail…"
                    />
                  )}

                  {/* Tab switcher */}
                  <div className={styles.fieldGroup}>
                    <div className={styles.tabBar} role="tablist" aria-label="Modo de edição do corpo">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={bodyTab === 'edit'}
                        className={`${styles.tab} ${bodyTab === 'edit' ? styles.tabActive : ''}`}
                        onClick={() => setBodyTab('edit')}
                        aria-controls="panel-edit-c"
                        id="tab-edit-c"
                      >
                        <Code size={14} aria-hidden="true" />
                        Edição
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={bodyTab === 'preview'}
                        className={`${styles.tab} ${bodyTab === 'preview' ? styles.tabActive : ''}`}
                        onClick={() => setBodyTab('preview')}
                        aria-controls="panel-preview-c"
                        id="tab-preview-c"
                      >
                        <Eye size={14} aria-hidden="true" />
                        Preview
                      </button>
                    </div>

                    <div id="panel-edit-c" role="tabpanel" aria-labelledby="tab-edit-c" hidden={bodyTab !== 'edit'}>
                      <label className={styles.srOnly} htmlFor="version-body-c">Corpo da mensagem</label>
                      <textarea
                        id="version-body-c"
                        className={`${styles.textarea} ${styles.textareaBody}`}
                        value={selectedVersion.body ?? ''}
                        onChange={(e) => handleVersionFieldChange('body', e.target.value)}
                        placeholder="Digite o corpo da mensagem. Use {{variavel}} para inserir variáveis dinâmicas…"
                        rows={12}
                        aria-label="Corpo da versão do template"
                      />
                    </div>

                    <div id="panel-preview-c" role="tabpanel" aria-labelledby="tab-preview-c" hidden={bodyTab !== 'preview'}>
                      {bodyIsHtml ? (
                        /* eslint-disable-next-line react/no-danger */
                        <div
                          className={styles.bodyPreview}
                          dangerouslySetInnerHTML={{ __html: selectedVersion.body }}
                          aria-label="Preview do corpo HTML"
                        />
                      ) : (
                        <pre className={`${styles.bodyPreview} ${styles.bodyPreviewText}`}>
                          {selectedVersion.body || (
                            <span className={styles.previewEmpty}>Nenhum conteúdo para exibir.</span>
                          )}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Variáveis detectadas */}
                  <div className={styles.variablesPanel} aria-label="Variáveis detectadas">
                    <div className={styles.variablesPanelHeader}>
                      <Tag size={15} aria-hidden="true" />
                      <span className={styles.variablesPanelTitle}>Variáveis detectadas</span>
                    </div>
                    <div className={styles.variablesList} aria-live="polite" aria-atomic="true">
                      {extractedVariables.length === 0 ? (
                        <p className={styles.variablesEmpty}>
                          Nenhuma variável detectada. Use{' '}
                          <code className={styles.inlineCode}>{'{{nome_da_variavel}}'}</code>{' '}
                          no corpo da mensagem.
                        </p>
                      ) : (
                        extractedVariables.map((variable) => (
                          <VariableChip key={variable} variable={variable} />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Salvar Template — único botão de submit em criação */}
                  <div className={styles.stepActions}>
                    <Button
                      type="button"
                      variant="primary"
                      isLoading={isSaving}
                      disabled={!canSaveCreate}
                      onClick={handleCreateSubmit}
                      aria-label="Salvar template com conteúdo"
                      aria-disabled={!canSaveCreate}
                    >
                      <Save size={16} aria-hidden="true" />
                      Salvar Template
                    </Button>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
