/**
 * @file NotificationFormPage.jsx
 * @description Página de criação de notificações do sistema HERMES.
 *
 * Permite ao usuário compor e enviar (ou agendar) uma notificação para um ou mais
 * destinatários, a partir de um template versionado, preenchendo as variáveis
 * dinâmicas e anexando arquivos (somente canal EMAIL).
 *
 * Fluxo de preenchimento:
 *   1. Selecionar o template → versões disponíveis são carregadas
 *   2. Selecionar a versão → variáveis obrigatórias são derivadas
 *   3. Preencher destinatários (TO obrigatório; CC/BCC opcionais e colapsáveis)
 *   4. Preencher variáveis dinâmicas (se houver)
 *   5. Definir agendamento (imediato ou data/hora futura)
 *   6. Anexar arquivos, se canal for EMAIL (limite 10 MB total)
 *   7. Submeter → modal de sucesso com opções de nova notificação ou dashboard
 *
 * Dependências externas:
 *   - useNotificationFormViewModel (lógica e estado)
 *   - useAuth (dados do usuário autenticado)
 *   - react-router-dom (useNavigate)
 *   - lucide-react (ícones)
 *   - Componentes comuns: Button, InputField, Modal, Badge, LoadingSpinner
 *   - Componentes específicos: RecipientInput, SchedulePicker
 *   - appConstants: ROUTES, EMAIL, NOTIFICATION, UI
 *   - formatters: formatDate, formatBytes
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Clock,
  Paperclip,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Variable,
  FileText,
  Users,
  Zap,
} from 'lucide-react';

import { useNotificationFormViewModel } from '../../viewmodels/useNotificationFormViewModel';
import { useAuth } from '../../core/auth/useAuth';
import { ROUTES, EMAIL, NOTIFICATION, UI } from '../../core/constants/appConstants';
import { NotificationChannel } from '../../models/Notification';

import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import Modal from '../components/common/Modal';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import RecipientInput from '../components/notification/RecipientInput';
import SchedulePicker from '../components/notification/SchedulePicker';

import { formatBytes } from '../../utils/Formatters';

import styles from './NotificationFormPage.module.css';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converte snake_case / camelCase para "Título Case" legível.
 * @param {string} key
 * @returns {string}
 */
function formatVariableLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Retorna a variante de Badge correspondente ao canal.
 * @param {string} channel
 * @returns {string}
 */
function channelBadgeVariant(channel) {
  const map = {
    [NotificationChannel.EMAIL]: 'info',
    [NotificationChannel.SMS]: 'warning',
    [NotificationChannel.WHATSAPP]: 'success',
  };
  return map[channel] ?? 'default';
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function NotificationFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // --- ViewModel ---
  const {
    form,
    recipients,
    variables,
    attachments,
    totalAttachmentSize,
    templates,
    availableVersions,
    requiredVariables,
    selectedTemplate,
    selectedVersion,
    isLoading,
    isSending,
    error,
    fieldErrors,
    handleChange,
    handleRecipientsChange,
    handleVariableChange,
    handleTemplateChange,
    handleVersionChange,
    handleAttachmentsChange,
    handleToggleImmediate,
    handleSubmit,
  } = useNotificationFormViewModel();

  // --- Estado local (somente UI) ---
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers de anexo
  // ---------------------------------------------------------------------------

  const handleFileSelect = useCallback(
    (files) => {
      if (!files) return;
      const combined = [...attachments, ...Array.from(files)];
      handleAttachmentsChange(combined);
    },
    [attachments, handleAttachmentsChange]
  );

  const handleRemoveAttachment = useCallback(
    (index) => {
      const updated = attachments.filter((_, i) => i !== index);
      handleAttachmentsChange(updated);
    },
    [attachments, handleAttachmentsChange]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const onSubmit = useCallback(async () => {
    const ok = await handleSubmit();
    if (ok) setShowSuccessModal(true);
  }, [handleSubmit]);

  // ---------------------------------------------------------------------------
  // Dados derivados para UI
  // ---------------------------------------------------------------------------

  const totalRecipients =
    recipients.to.length + recipients.cc.length + recipients.bcc.length;
  const nearLimit = totalRecipients >= EMAIL.MAX_RECIPIENTS * 0.8;

  const attachmentPercent = Math.min(
    (totalAttachmentSize / EMAIL.MAX_TOTAL_SIZE_BYTES) * 100,
    100
  );
  const attachmentOverLimit = totalAttachmentSize > EMAIL.MAX_TOTAL_SIZE_BYTES;
  const attachmentNearLimit = attachmentPercent > 80 && !attachmentOverLimit;

  const isEmailChannel = selectedTemplate?.channel === NotificationChannel.EMAIL;

  const minDateTime = new Date(
    Date.now() + NOTIFICATION.MIN_SCHEDULE_OFFSET_MINUTES * 60000
  ).toISOString();

  const submitLabel = form.isImmediate ? 'Enviar Notificação' : 'Agendar Notificação';
  const submitIcon = form.isImmediate ? Send : Clock;
  const SubmitIcon = submitIcon;

  // Tamanho máximo em MB para exibição legível na UI
  const maxSizeMB = EMAIL.MAX_TOTAL_SIZE_BYTES / 1024 / 1024;

  // ---------------------------------------------------------------------------
  // Render: estado de carregamento inicial
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <LoadingSpinner />
        <p className={styles.loadingText}>Carregando templates…</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render principal
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.page}>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => navigate('/dashboard')}
          aria-label="Voltar ao Dashboard"
        >
          <ArrowLeft size={18} />
          <span>Dashboard</span>
        </button>

        <div className={styles.headerMeta}>
          <div className={styles.headerAccent} aria-hidden="true" />
          <div>
            <h1 className={styles.title}>Nova Notificação</h1>
            <p className={styles.subtitle}>
              Preencha os dados para enviar ou agendar uma comunicação
            </p>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Banner de erro global                                                */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} className={styles.errorBannerIcon} />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Layout principal (duas colunas)                                      */}
      {/* ------------------------------------------------------------------ */}
      <main className={styles.layout}>
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* COLUNA ESQUERDA — Destinatários + Agendamento                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section className={styles.column} aria-label="Destinatários e agendamento">
          {/* Card: Destinatários */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <Users size={16} />
              </span>
              <h2 className={styles.cardTitle}>Destinatários</h2>
              {totalRecipients > 0 && (
                <span
                  className={`${styles.recipientCount} ${nearLimit ? styles.recipientCountWarn : ''}`}
                >
                  {totalRecipients}/{EMAIL.MAX_RECIPIENTS}
                </span>
              )}
            </div>

            <div className={styles.cardBody}>
              {/* Para */}
              <RecipientInput
                label="Para"
                value={recipients.to}
                onChange={(emails) => handleRecipientsChange('to', emails)}
                error={fieldErrors.to}
                placeholder="Digite um e-mail e pressione Enter"
                aria-required="true"
              />

              {/* Toggle CC */}
              <button
                className={styles.toggleLink}
                onClick={() => setShowCc((v) => !v)}
                aria-expanded={showCc}
                type="button"
              >
                {showCc ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                {showCc ? 'Ocultar CC' : '+ Adicionar CC'}
              </button>

              {showCc && (
                <RecipientInput
                  label="CC (Com Cópia)"
                  value={recipients.cc}
                  onChange={(emails) => handleRecipientsChange('cc', emails)}
                  error={fieldErrors.cc}
                  placeholder="Digite um e-mail e pressione Enter"
                />
              )}

              {/* Toggle BCC */}
              <button
                className={styles.toggleLink}
                onClick={() => setShowBcc((v) => !v)}
                aria-expanded={showBcc}
                type="button"
              >
                {showBcc ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                {showBcc ? 'Ocultar CCO' : '+ Adicionar CCO'}
              </button>

              {showBcc && (
                <RecipientInput
                  label="CCO (Cópia Oculta)"
                  value={recipients.bcc}
                  onChange={(emails) => handleRecipientsChange('bcc', emails)}
                  error={fieldErrors.bcc}
                  placeholder="Digite um e-mail e pressione Enter"
                />
              )}

              {nearLimit && (
                <p className={styles.recipientWarnMsg}>
                  <AlertCircle size={13} />
                  Você está próximo do limite de destinatários.
                </p>
              )}
            </div>
          </div>

          {/* Card: Agendamento */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <Clock size={16} />
              </span>
              <h2 className={styles.cardTitle}>Agendamento</h2>
            </div>

            <div className={styles.cardBody}>
              {/* Toggle switch */}
              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>
                    {form.isImmediate && <Zap size={14} className={styles.zapIcon} />}
                    Envio Imediato
                  </span>
                  <span className={styles.toggleDescription}>
                    {form.isImmediate
                      ? 'A notificação será enviada assim que confirmada'
                      : 'Defina data e hora para o envio'}
                  </span>
                </div>
                <button
                  role="switch"
                  aria-checked={form.isImmediate}
                  className={`${styles.toggleSwitch} ${form.isImmediate ? styles.toggleSwitchOn : ''}`}
                  onClick={handleToggleImmediate}
                  type="button"
                  aria-label="Alternar entre envio imediato e agendado"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>

              {form.isImmediate ? (
                <div className={styles.immediateHint}>
                  <CheckCircle2 size={14} />
                  <span>A notificação será enviada imediatamente após a confirmação</span>
                </div>
              ) : (
                <div className={styles.schedulerWrapper}>
                  <SchedulePicker
                    value={form.scheduledAt}
                    onChange={(iso) => handleChange('scheduledAt', iso)}
                    disabled={false}
                    minDateTime={minDateTime}
                  />
                  {fieldErrors.scheduledAt && (
                    <p className={styles.fieldError}>{fieldErrors.scheduledAt}</p>
                  )}
                  <p className={styles.timezoneHint}>
                    Horário no fuso de Brasília (GMT−3). A notificação será
                    processada alguns segundos antes do horário selecionado.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* COLUNA DIREITA — Template + Variáveis + Anexos                  */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section className={styles.column} aria-label="Template, variáveis e anexos">
          {/* Card: Template */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <FileText size={16} />
              </span>
              <h2 className={styles.cardTitle}>Template</h2>
              {selectedTemplate && (
                <Badge
                  label={UI.CHANNEL_LABEL[selectedTemplate.channel] ?? selectedTemplate.channel}
                  variant={channelBadgeVariant(selectedTemplate.channel)}
                />
              )}
            </div>

            <div className={styles.cardBody}>
              {/* Select: Template */}
              <div className={styles.selectWrapper}>
                <label className={styles.selectLabel} htmlFor="template-select">
                  Template <span className={styles.required}>*</span>
                </label>
                <div className={styles.selectControl}>
                  <select
                    id="template-select"
                    className={`${styles.select} ${fieldErrors.templateId ? styles.selectError : ''}`}
                    value={form.templateId ?? ''}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    aria-required="true"
                    aria-invalid={!!fieldErrors.templateId}
                  >
                    <option value="" disabled>
                      Selecione um template…
                    </option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className={styles.selectChevron} aria-hidden="true" />
                </div>
                {fieldErrors.templateId && (
                  <p className={styles.fieldError}>{fieldErrors.templateId}</p>
                )}
              </div>

              {/* Select: Versão */}
              {selectedTemplate && availableVersions.length > 0 && (
                <div className={styles.selectWrapper}>
                  <label className={styles.selectLabel} htmlFor="version-select">
                    Versão
                  </label>
                  <div className={styles.selectControl}>
                    <select
                      id="version-select"
                      className={styles.select}
                      value={form.templateVersionId ?? ''}
                      onChange={(e) => handleVersionChange(e.target.value)}
                    >
                      {availableVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name ?? `v${v.version}`}{' '}
                          {v.isDraft ? '(rascunho)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className={styles.selectChevron} aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Variáveis */}
          {selectedTemplate && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>
                  <Variable size={16} />
                </span>
                <h2 className={styles.cardTitle}>Variáveis</h2>
                {requiredVariables.length > 0 && (
                  <span className={styles.variableCount}>
                    {requiredVariables.length} campo
                    {requiredVariables.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className={styles.cardBody}>
                {requiredVariables.length > 0 ? (
                  <div className={styles.variablesGrid}>
                    {requiredVariables.map((key) => (
                      <InputField
                        key={key}
                        label={formatVariableLabel(key)}
                        name={key}
                        type="text"
                        value={variables[key] ?? ''}
                        onChange={(e) => handleVariableChange(key, e.target.value)}
                        error={fieldErrors[`variable_${key}`]}
                        placeholder={`Valor para "${formatVariableLabel(key)}"`}
                        required
                      />
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyVariables}>
                    Este template não possui variáveis a preencher.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Card: Anexos (somente EMAIL) */}
          {isEmailChannel && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>
                  <Paperclip size={16} />
                </span>
                <h2 className={styles.cardTitle}>Anexos</h2>
                {attachments.length > 0 && (
                  <span className={styles.attachmentCount}>
                    {attachments.length} arquivo
                    {attachments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className={styles.cardBody}>
                {/* Drag-and-drop */}
                <div
                  className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''} ${attachmentOverLimit ? styles.dropzoneError : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Área para arrastar e soltar arquivos ou clique para selecionar"
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                >
                  <Paperclip size={22} className={styles.dropzoneIcon} />
                  <p className={styles.dropzoneText}>
                    Arraste arquivos aqui ou{' '}
                    <span className={styles.dropzoneLink}>clique para selecionar</span>
                  </p>
                  <p className={styles.dropzoneHint}>
                    Formatos: {EMAIL.ALLOWED_ATTACHMENT_TYPES.join(', ')} · Limite:{' '}
                    {maxSizeMB} MB total
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className={styles.hiddenFileInput}
                  accept={EMAIL.ALLOWED_ATTACHMENT_TYPES.join(',')}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  aria-hidden="true"
                  tabIndex={-1}
                />

                {/* Barra de uso */}
                <div
                  className={styles.storageBar}
                  aria-live="polite"
                  aria-label={`Uso de espaço: ${formatBytes(totalAttachmentSize)} de ${maxSizeMB} MB`}
                >
                  <div className={styles.storageBarLabels}>
                    <span className={attachmentOverLimit ? styles.storageLabelError : ''}>
                      {formatBytes(totalAttachmentSize)}
                    </span>
                    <span className={styles.storageLabelLimit}>{maxSizeMB} MB</span>
                  </div>
                  <div className={styles.storageTrack}>
                    <div
                      className={`${styles.storageFill} ${
                        attachmentOverLimit
                          ? styles.storageFillError
                          : attachmentNearLimit
                          ? styles.storageFillWarn
                          : ''
                      }`}
                      style={{ width: `${attachmentPercent}%` }}
                    />
                  </div>
                  {attachmentOverLimit && (
                    <p className={styles.storageErrorMsg}>
                      <AlertCircle size={13} />
                      Total de anexos excede o limite de {maxSizeMB} MB.
                    </p>
                  )}
                  {attachmentNearLimit && (
                    <p className={styles.storageWarnMsg}>
                      <AlertCircle size={13} />
                      Você está próximo do limite de espaço.
                    </p>
                  )}
                </div>

                {/* Lista de arquivos */}
                {attachments.length > 0 && (
                  <ul className={styles.attachmentList} aria-label="Arquivos selecionados">
                    {attachments.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className={styles.attachmentItem}>
                        <Paperclip size={14} className={styles.attachmentItemIcon} />
                        <span className={styles.attachmentName}>{file.name}</span>
                        <span className={styles.attachmentSize}>{formatBytes(file.size)}</span>
                        <button
                          className={styles.removeAttachment}
                          onClick={() => handleRemoveAttachment(idx)}
                          type="button"
                          aria-label={`Remover ${file.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {fieldErrors.attachments && (
                  <p className={styles.fieldError}>{fieldErrors.attachments}</p>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Footer de ação (sticky)                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer className={styles.footer}>
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          disabled={isSending}
          type="button"
        >
          Cancelar
        </Button>

        <Button
          variant="primary"
          onClick={onSubmit}
          isLoading={isSending}
          disabled={isSending}
          type="button"
        >
          <SubmitIcon size={16} />
          {submitLabel}
        </Button>
      </footer>

      {/* ------------------------------------------------------------------ */}
      {/* Modal de sucesso                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title=""
        footer={
          <div className={styles.successModalActions}>
            <Button
              variant="ghost"
              onClick={() => {
                setShowSuccessModal(false);
                window.location.reload();
              }}
              type="button"
            >
              Enviar outra
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/')}
              type="button"
            >
              Ver Dashboard
            </Button>
          </div>
        }
      >
        <div className={styles.successModal}>
          <div className={styles.successIcon} aria-hidden="true">
            <CheckCircle2 size={56} />
          </div>
          <h2 className={styles.successTitle}>
            {form.isImmediate
              ? 'Notificação enviada com sucesso!'
              : 'Notificação agendada com sucesso!'}
          </h2>
          <p className={styles.successDescription}>
            {form.isImmediate
              ? 'Sua notificação foi colocada na fila de envio e será processada em instantes.'
              : `Sua notificação será enviada em ${
                  form.scheduledAt
                    ? new Date(form.scheduledAt).toLocaleString('pt-BR')
                    : 'breve'
                }.`}
          </p>
        </div>
      </Modal>
    </div>
  );
}