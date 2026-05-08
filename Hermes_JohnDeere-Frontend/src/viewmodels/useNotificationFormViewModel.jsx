import { useState, useEffect, useMemo } from 'react';
import { notificationService } from '../services/notificationService';
import { templateService } from '../services/templateService';
import { getLatestVersion } from '../models/Template';
import { validateNotification } from '../models/Notification';
import { EMAIL } from '../core/constants/appConstants';

/**
 * Limite máximo de tamanho total de anexos.
 * Usa EMAIL.MAX_TOTAL_SIZE_BYTES (não MAX_SIZE_BYTES — essa chave não existe).
 */
const MAX_ATTACHMENT_BYTES = EMAIL.MAX_TOTAL_SIZE_BYTES; // 10 * 1024 * 1024

/**
 * Regex de validação de e-mail.
 * EMAIL.REGEX não existe em appConstants — definida aqui localmente.
 * Padrão RFC 5321 simplificado, adequado para validação de UI.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  templateId: '',
  templateVersionId: '',
  recipients: { to: [], cc: [], bcc: [] },
  variables: {},
  scheduledAt: '',
  isImmediate: true,
};

const EMPTY_FIELD_ERRORS = {
  templateId: '',
  to: '',
  cc: '',
  bcc: '',
  scheduledAt: '',
  attachments: '',
};

/**
 * Valida se um endereço de e-mail é válido.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Valida destinatários e retorna erros por campo.
 * @param {{ to: string[], cc: string[], bcc: string[] }} recipients
 * @returns {{ to: string, cc: string, bcc: string }}
 */
function validateRecipientFields(recipients) {
  const errors = { to: '', cc: '', bcc: '' };

  if (recipients.to.length === 0) {
    errors.to = 'É necessário ao menos um destinatário no campo TO.';
  } else {
    const invalid = recipients.to.find((e) => !isValidEmail(e));
    if (invalid) errors.to = `E-mail inválido: "${invalid}"`;
  }

  const invalidCc = recipients.cc.find((e) => !isValidEmail(e));
  if (invalidCc) errors.cc = `E-mail inválido: "${invalidCc}"`;

  const invalidBcc = recipients.bcc.find((e) => !isValidEmail(e));
  if (invalidBcc) errors.bcc = `E-mail inválido: "${invalidBcc}"`;

  return errors;
}

/**
 * @param {object | null} version
 * @returns {string[]}
 */
function extractRequiredVariables(version) {
  if (!version?.variables || !Array.isArray(version.variables)) return [];
  return version.variables;
}

/**
 * ViewModel para o formulário de envio/agendamento de Notificações.
 *
 * Retorno ACHADO (flat) para compatibilidade com NotificationFormPage,
 * que desestrutura todos os campos diretamente do hook.
 *
 * Correções em relação às constantes reais de appConstants:
 *  - EMAIL.MAX_TOTAL_SIZE_BYTES  (era MAX_SIZE_BYTES — não existe)
 *  - EMAIL.ALLOWED_ATTACHMENT_TYPES (era ALLOWED_EXTENSIONS — não existe)
 *  - EMAIL_REGEX definida localmente (EMAIL.REGEX não existe em appConstants)
 *  - PAGINATION.DEFAULT_PAGE_SIZE (era DEFAULT_LIMIT — não existe)
 *
 * @returns {{
 *   form: object,
 *   recipients: { to: string[], cc: string[], bcc: string[] },
 *   variables: Record<string, string>,
 *   attachments: File[],
 *   totalAttachmentSize: number,
 *   templates: object[],
 *   selectedTemplate: object | null,
 *   selectedVersion: object | null,
 *   availableVersions: object[],
 *   requiredVariables: string[],
 *   isLoading: boolean,
 *   isSending: boolean,
 *   error: string | null,
 *   fieldErrors: Record<string, string>,
 *   handleChange: Function,
 *   handleRecipientsChange: Function,
 *   handleVariableChange: Function,
 *   handleTemplateChange: Function,
 *   handleVersionChange: Function,
 *   handleAttachmentsChange: Function,
 *   handleToggleImmediate: Function,
 *   handleSubmit: () => Promise<boolean>
 * }}
 */
export function useNotificationFormViewModel() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachments, setAttachments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [availableVersions, setAvailableVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);

  // Atalhos expostos na raiz para a View não acessar form.recipients e form.variables
  const recipients = form.recipients;
  const variables = form.variables;

  const totalAttachmentSize = useMemo(
    () => attachments.reduce((sum, f) => sum + f.size, 0),
    [attachments]
  );

  const selectedVersion = useMemo(
    () => availableVersions.find((v) => v.id === form.templateVersionId) ?? null,
    [availableVersions, form.templateVersionId]
  );

  const requiredVariables = useMemo(
    () => extractRequiredVariables(selectedVersion),
    [selectedVersion]
  );

  // Carrega templates ao montar
  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setIsLoading(true);
      try {
        const result = await templateService.listTemplates({ page: 1, limit: 999 });
        if (!cancelled) setTemplates(result.data);
      } catch (err) {
        if (cancelled) return;
        if (err?.details) {
          console.error('[useNotificationFormViewModel] Erro ao carregar templates:', err.details);
        }
        setError(err?.message ?? 'Erro ao carregar lista de templates.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadTemplates();
    return () => { cancelled = true; };
  }, []);

  // ---------- Ações ----------

   /**
   * Atualiza um campo genérico do formulário.
   * @param {string} field
   * @param {*} value
   */
  function handleChange(field, value) {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Atualiza a lista de destinatários de um tipo específico (to, cc, bcc).
   * @param {'to' | 'cc' | 'bcc'} type
   * @param {string[]} value - Array de e-mails
   */
  function handleRecipientsChange(type, value) {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, [type]: '' }));
    setForm((prev) => ({
      ...prev,
      recipients: { ...prev.recipients, [type]: value },
    }));
  }

  /**
   * Atualiza o valor de uma variável de template específica.
   * @param {string} key - Nome da variável
   * @param {string} value
   */
  function handleVariableChange(key, value) {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, [`variable_${key}`]: '' }));
    setForm((prev) => ({
      ...prev,
      variables: { ...prev.variables, [key]: value },
    }));
  }

  /**
   * Seleciona um template pelo ID, carrega suas versões e pré-seleciona a mais recente.
   * @param {string} templateId
   */
  async function handleTemplateChange(templateId) {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, templateId: '' }));
    setForm((prev) => ({ ...prev, templateId, templateVersionId: '', variables: {} }));
    setAvailableVersions([]);
    setSelectedTemplate(null);

    if (!templateId) return;

    setIsLoading(true);

    try {
      const template = await templateService.getTemplate(templateId);
      const versionList = Array.isArray(template.versions) ? template.versions : [];

      setSelectedTemplate(template);
      setAvailableVersions(versionList);

      const latest = getLatestVersion(template);
      if (latest) {
        setForm((prev) => ({ ...prev, templateVersionId: latest.id }));
      }
    } catch (err) {
      if (err?.details) {
        console.error('[useNotificationFormViewModel] Erro ao carregar template:', err.details);
      }
      setError(err?.message ?? 'Erro ao carregar versões do template.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleVersionChange(versionId) {
    setForm((prev) => ({ ...prev, templateVersionId: versionId, variables: {} }));
  }

  /**
   * Atualiza a lista de anexos a partir de um FileList ou array de File.
   * Não valida o tamanho aqui — a validação ocorre no submit para permitir
   * que a View exiba o tamanho atual em tempo real.
   * @param {FileList | File[]} files
   */
  function handleAttachmentsChange(files) {
    setFieldErrors((prev) => ({ ...prev, attachments: '' }));
    setAttachments(Array.from(files));
  }

  /**
   * Alterna entre envio imediato e agendado.
   * Ao voltar para imediato, limpa o campo scheduledAt.
   */
  function handleToggleImmediate() {
    setFieldErrors((prev) => ({ ...prev, scheduledAt: '' }));
    setForm((prev) => ({
      ...prev,
      isImmediate: !prev.isImmediate,
      scheduledAt: !prev.isImmediate ? '' : prev.scheduledAt,
    }));
  }

  /**
   * Valida e envia (ou agenda) a notificação.
   * Realiza todas as validações locais antes de chamar o service.
   * @returns {Promise<boolean>} `true` em sucesso, `false` em falha
   */
  async function handleSubmit() {
    setError(null);
    setFieldErrors(EMPTY_FIELD_ERRORS);

    let hasErrors = false;
    const nextFieldErrors = { ...EMPTY_FIELD_ERRORS };

    if (!form.templateId) {
      nextFieldErrors.templateId = 'Selecione um template.';
      hasErrors = true;
    }

    const recipientErrors = validateRecipientFields(form.recipients);
    if (recipientErrors.to)  { nextFieldErrors.to  = recipientErrors.to;  hasErrors = true; }
    if (recipientErrors.cc)  { nextFieldErrors.cc  = recipientErrors.cc;  hasErrors = true; }
    if (recipientErrors.bcc) { nextFieldErrors.bcc = recipientErrors.bcc; hasErrors = true; }

    const missingVars = requiredVariables.filter(
      (key) => !form.variables[key] || form.variables[key].trim() === ''
    );
    if (missingVars.length > 0) {
      missingVars.forEach((key) => {
        nextFieldErrors[`variable_${key}`] = 'Campo obrigatório.';
      });
      hasErrors = true;
    }

    if (!form.isImmediate && !form.scheduledAt) {
      nextFieldErrors.scheduledAt = 'Informe a data e hora de envio.';
      hasErrors = true;
    }

    if (totalAttachmentSize > MAX_ATTACHMENT_BYTES) {
      const totalMB = (totalAttachmentSize / 1024 / 1024).toFixed(2);
      nextFieldErrors.attachments = `Total de anexos (${totalMB} MB) excede o limite de 10 MB.`;
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(nextFieldErrors);
      return false;
    }

    const modelError = validateNotification({
      templateId: form.templateId,
      templateVersionId: form.templateVersionId,
      recipients: form.recipients,
      variables: form.variables,
      scheduledAt: form.isImmediate ? null : form.scheduledAt ? `${form.scheduledAt}:00Z` : null,
    });

    if (!modelError.valid) {
      setError(modelError.errors.join('\n'));
      return false;
    }

    setIsSending(true);

    try {
      await notificationService.sendNotification(
        {
          channel: selectedTemplate?.channel,
          templateId: form.templateId,
          templateVersionId: form.templateVersionId,
          recipients: form.recipients,
          variables: form.variables,
          scheduledAt: form.isImmediate ? null : form.scheduledAt ? `${form.scheduledAt}:00Z` : null,
        },
        attachments.length ? attachments : undefined
      );
      return true;
    } catch (err) {
      if (err?.details) {
        console.error('[useNotificationFormViewModel] Erro ao enviar notificação:', err.details);
      }
      setError(err?.message ?? 'Erro ao enviar notificação.');
      return false;
    } finally {
      setIsSending(false);
    }
  }

  // Retorno flat — a View desestrutura tudo no nível raiz
  return {
    form,
    recipients,
    variables,
    attachments,
    totalAttachmentSize,
    templates,
    selectedTemplate,
    selectedVersion,
    availableVersions,
    requiredVariables,
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
  };
}
