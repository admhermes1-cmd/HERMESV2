/**
 * @file TemplateFormPage.jsx
 * @description Página de criação e edição de Templates do sistema HERMES.
 *
 * Opera em dois modos distintos:
 *  - **Criação** (`/templates/new`): exibe formulário em branco; canal configurável via select.
 *  - **Edição** (`/templates/:id/edit`): carrega template existente; canal é imutável (Badge read-only).
 *
 * Layout em duas colunas:
 *  - Esquerda: metadados do template (nome, descrição, canal).
 *  - Direita: editor de versões com tab switcher Edição/Preview.
 *
 * @dependencies
 *  - `useTemplateFormViewModel` — toda a lógica de negócio (form, versões, ações).
 *  - `useNavigate` (react-router-dom) — navegação pós-submit.
 *  - `useAuth` (core/auth) — dados do usuário autenticado.
 *  - Componentes comuns: Button, InputField, Modal, Badge, LoadingSpinner.
 *  - Componente de template: TemplateVersionSelector.
 *  - Constantes: ROUTES, TEMPLATE, UI (appConstants).
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

const CHANNEL_OPTIONS = [
  { value: TemplateChannel.EMAIL,    label: 'E-mail'    },
  { value: TemplateChannel.SMS,      label: 'SMS'        },
  { value: TemplateChannel.WHATSAPP, label: 'WhatsApp'   },
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
  } = useTemplateFormViewModel();

  /** Controla a aba ativa no editor de body: 'edit' | 'preview' */
  const [bodyTab, setBodyTab] = useState('edit');

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBack = () => navigate(ROUTES.TEMPLATES);

  const handleFormSubmit = async () => {
    const ok = await handleSubmit();
    if (ok) navigate(ROUTES.TEMPLATES);
  };

  const handleSaveSelectedVersion = async () => {
    if (!selectedVersion) return;
    await handleSaveVersion(selectedVersion.id);
  };

  // ── Derivados ─────────────────────────────────────────────────────────────

  const channelBadgeVariant = UI.BADGE_VARIANTS?.[form.channel] ?? 'info';
  const channelLabel = UI.CHANNEL_LABELS?.[form.channel]
    ?? CHANNEL_OPTIONS.find(o => o.value === form.channel)?.label
    ?? form.channel;

  const bodyIsHtml = containsHtml(selectedVersion?.body ?? '');

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
      ) : (
        <div className={styles.layout}>

          {/* ════════════════════════════════════════════════════════════
              COLUNA ESQUERDA — Metadados do Template
          ════════════════════════════════════════════════════════════ */}
          <section className={styles.column} aria-label="Metadados do template">
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FileText size={18} aria-hidden="true" />
                <h2 className={styles.cardTitle}>Informações do Template</h2>
              </div>

              <fieldset className={styles.fieldset}>
                <legend className={styles.srOnly}>Dados gerais</legend>

                {/* Nome */}
                <InputField
                  label="Nome do Template"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ex: Boas-vindas ao cliente"
                  required
                />

                {/* Descrição */}
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

                {/* Canal */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="template-channel">
                    Canal de envio
                  </label>

                  {isEditMode ? (
                    <div className={styles.channelReadOnly}>
                      <Badge label={channelLabel} variant={channelBadgeVariant} />
                      <p className={styles.channelHint}>
                        O canal não pode ser alterado após a criação.
                      </p>
                    </div>
                  ) : (
                    <select
                      id="template-channel"
                      className={styles.select}
                      value={form.channel}
                      onChange={(e) => handleChange('channel', e.target.value)}
                      aria-label="Selecionar canal de envio"
                    >
                      <option value="" disabled>Selecione um canal…</option>
                      {CHANNEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </fieldset>

              <div className={styles.cardActions}>
                <Button
                  type="button"
                  variant="primary"
                  isLoading={isSaving}
                  onClick={handleFormSubmit}
                  aria-label="Salvar template"
                >
                  <Save size={16} aria-hidden="true" />
                  Salvar Template
                </Button>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              COLUNA DIREITA — Editor de Versão
          ════════════════════════════════════════════════════════════ */}
          <section className={styles.column} aria-label="Editor de versões">
            <div className={styles.card}>

              {/* Header do card de versões */}
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

              {/* Seletor de versão */}
              {versions.length > 0 && (
                <TemplateVersionSelector
                  versions={versions}
                  selectedId={selectedVersion?.id}
                  onChange={handleVersionChange}
                />
              )}

              {/* Editor da versão selecionada */}
              {selectedVersion ? (
                <div className={styles.versionEditor}>

                  {/* Assunto — somente e-mail */}
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

                  {/* Tab switcher — Edição / Preview */}
                  <div className={styles.fieldGroup}>
                    <div
                      className={styles.tabBar}
                      role="tablist"
                      aria-label="Modo de edição do corpo"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={bodyTab === 'edit'}
                        className={`${styles.tab} ${bodyTab === 'edit' ? styles.tabActive : ''}`}
                        onClick={() => setBodyTab('edit')}
                        aria-controls="panel-edit"
                        id="tab-edit"
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
                        aria-controls="panel-preview"
                        id="tab-preview"
                      >
                        <Eye size={14} aria-hidden="true" />
                        Preview
                      </button>
                    </div>

                    {/* Painel: Edição */}
                    <div
                      id="panel-edit"
                      role="tabpanel"
                      aria-labelledby="tab-edit"
                      hidden={bodyTab !== 'edit'}
                    >
                      <label className={styles.srOnly} htmlFor="version-body">
                        Corpo da mensagem
                      </label>
                      <textarea
                        id="version-body"
                        className={`${styles.textarea} ${styles.textareaBody}`}
                        value={selectedVersion.body ?? ''}
                        onChange={(e) => handleVersionFieldChange('body', e.target.value)}
                        placeholder="Digite o corpo da mensagem. Use {{variavel}} para inserir variáveis dinâmicas…"
                        rows={10}
                        aria-label="Corpo da versão do template"
                      />
                    </div>

                    {/* Painel: Preview */}
                    <div
                      id="panel-preview"
                      role="tabpanel"
                      aria-labelledby="tab-preview"
                      hidden={bodyTab !== 'preview'}
                    >
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
                            <span className={styles.previewEmpty}>
                              Nenhum conteúdo para exibir.
                            </span>
                          )}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Painel de variáveis detectadas */}
                  <div className={styles.variablesPanel} aria-label="Variáveis detectadas">
                    <div className={styles.variablesPanelHeader}>
                      <Tag size={15} aria-hidden="true" />
                      <span className={styles.variablesPanelTitle}>Variáveis detectadas</span>
                    </div>

                    <div
                      className={styles.variablesList}
                      aria-live="polite"
                      aria-atomic="true"
                    >
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

                  {/* Salvar versão */}
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
            </div>
          </section>

        </div>
      )}
    </div>
  );
}