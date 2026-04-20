import { useState, useEffect, useMemo } from 'react';
import { notificationService } from '../services/notificationService';
import { templateService } from '../services/Templateservice';
import { getLatestVersion } from '../models/Template';
import { validateNotification } from '../models/Notification';
import { EMAIL, NOTIFICATION } from '../core/constants/Appconstants';

/** Tamanho máximo total de anexos: 10 MB em bytes */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Estado inicial do formulário */
const EMPTY_FORM = {
  templateId: '',
  templateVersionId: '',
  recipients: { to: [], cc: [], bcc: [] },
  variables: {},
  scheduledAt: '',
  isImmediate: true,
};

/**
 * Valida se um endereço de e-mail é válido.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return EMAIL.REGEX.test(email.trim());
}

/**
 * Valida todos os endereços de e-mail em to, cc e bcc.
 * @param {{ to: string[], cc: string[], bcc: string[] }} recipients
 * @returns {string | null} Mensagem de erro ou null se tudo estiver válido
 */
function validateRecipients(recipients) {
  const all = [
    ...recipients.to.map((e) => ({ campo: 'TO', email: e })),
    ...recipients.cc.map((e) => ({ campo: 'CC', email: e })),
    ...recipients.bcc.map((e) => ({ campo: 'BCC', email: e })),
  ];

  for (const { campo, email } of all) {
    if (!isValidEmail(email)) {
      return `E-mail inválido no campo ${campo}: "${email}"`;
    }
  }

  if (recipients.to.length === 0) {
    return 'É necessário ao menos um destinatário no campo TO.';
  }

  return null;
}

/**
 * Extrai as variáveis obrigatórias de uma versão de template.
 * @param {import('../models/Template').TemplateVersion | null} version
 * @returns {string[]}
 */
function extractRequiredVariables(version) {
  if (!version?.variables || !Array.isArray(version.variables)) return [];
  return version.variables;
}

/**
 * ViewModel para o formulário de envio/agendamento de Notificações.
 *
 * Gerencia seleção de template + versão, destinatários, variáveis, anexos e agendamento.
 * Realiza validações locais antes de chamar o service.
 *
 * @returns {{
 *   state: {
 *     form: {
 *       templateId: string,
 *       templateVersionId: string,
 *       recipients: { to: string[], cc: string[], bcc: string[] },
 *       variables: Record<string, string>,
 *       scheduledAt: string,
 *       isImmediate: boolean
 *     },
 *     attachments: File[],
 *     templates: import('../models/Template').Template[],
 *     selectedTemplate: import('../models/Template').Template | null,
 *     availableVersions: import('../models/Template').TemplateVersion[],
 *     requiredVariables: string[],
 *     totalAttachmentSize: number,
 *     isLoading: boolean,
 *     isSending: boolean,
 *     error: string | null
 *   },
 *   actions: {
 *     handleChange: (field: string, value: any) => void,
 *     handleRecipientsChange: (type: 'to' | 'cc' | 'bcc', value: string[]) => void,
 *     handleVariableChange: (key: string, value: string) => void,
 *     handleTemplateChange: (templateId: string) => Promise<void>,
 *     handleVersionChange: (versionId: string) => void,
 *     handleAttachmentsChange: (files: FileList | File[]) => void,
 *     handleToggleImmediate: () => void,
 *     handleSubmit: () => Promise<boolean>
 *   }
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

  // ---------- Derivados ----------

  /** Soma total do tamanho dos arquivos anexados em bytes */
  const totalAttachmentSize = useMemo(
    () => attachments.reduce((sum, f) => sum + f.size, 0),
    [attachments]
  );

  /** Variáveis obrigatórias extraídas da versão selecionada */
  const requiredVariables = useMemo(() => {
    const version = availableVersions.find((v) => v.id === form.templateVersionId) ?? null;
    return extractRequiredVariables(version);
  }, [availableVersions, form.templateVersionId]);

  // ---------- Carrega lista de templates ao montar ----------
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
    setForm((prev) => ({
      ...prev,
      templateId,
      templateVersionId: '',
      variables: {},
    }));
    setAvailableVersions([]);
    setSelectedTemplate(null);

    if (!templateId) return;

    setIsLoading(true);

    try {
      const template = await templateService.getTemplate(templateId);
      const versionList = Array.isArray(template.versions) ? template.versions : [];

      setSelectedTemplate(template);
      setAvailableVersions(versionList);

      // Pré-seleciona a versão mais recente
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

  /**
   * Seleciona uma versão de template pelo ID e reseta as variáveis preenchidas.
   * @param {string} versionId
   */
  function handleVersionChange(versionId) {
    setForm((prev) => ({
      ...prev,
      templateVersionId: versionId,
      variables: {},
    }));
  }

  /**
   * Atualiza a lista de anexos a partir de um FileList ou array de File.
   * Não valida o tamanho aqui — a validação ocorre no submit para permitir
   * que a View exiba o tamanho atual em tempo real.
   * @param {FileList | File[]} files
   */
  function handleAttachmentsChange(files) {
    const fileArray = Array.from(files);
    setAttachments(fileArray);
  }

  /**
   * Alterna entre envio imediato e agendado.
   * Ao voltar para imediato, limpa o campo scheduledAt.
   */
  function handleToggleImmediate() {
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

    // ----- Validações locais -----

    if (!form.templateId) {
      setError('Selecione um template antes de enviar.');
      return false;
    }

    if (!form.templateVersionId) {
      setError('Selecione uma versão do template.');
      return false;
    }

    const recipientError = validateRecipients(form.recipients);
    if (recipientError) {
      setError(recipientError);
      return false;
    }

    // Variáveis obrigatórias preenchidas
    const missingVars = requiredVariables.filter(
      (key) => !form.variables[key] || form.variables[key].trim() === ''
    );
    if (missingVars.length > 0) {
      setError(`Preencha as variáveis obrigatórias: ${missingVars.join(', ')}`);
      return false;
    }

    // Tamanho total de anexos
    if (totalAttachmentSize > MAX_ATTACHMENT_BYTES) {
      const totalMB = (totalAttachmentSize / 1024 / 1024).toFixed(2);
      setError(`O tamanho total dos anexos (${totalMB} MB) excede o limite de 10 MB.`);
      return false;
    }

    // Validação via model (pode verificar outros campos obrigatórios)
    const modelError = validateNotification({
      templateId: form.templateId,
      templateVersionId: form.templateVersionId,
      recipients: form.recipients,
      variables: form.variables,
      scheduledAt: form.isImmediate ? null : form.scheduledAt || null,
    });

    if (modelError) {
      setError(modelError);
      return false;
    }

    // ----- Envio -----

    setIsSending(true);

    try {
      const payload = {
        templateId: form.templateId,
        templateVersionId: form.templateVersionId,
        recipients: form.recipients,
        variables: form.variables,
        scheduledAt: form.isImmediate ? null : form.scheduledAt || null,
      };

      await notificationService.sendNotification(payload, attachments.length ? attachments : undefined);
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

  return {
    state: {
      form,
      attachments,
      templates,
      selectedTemplate,
      availableVersions,
      requiredVariables,
      totalAttachmentSize,
      isLoading,
      isSending,
      error,
    },
    actions: {
      handleChange,
      handleRecipientsChange,
      handleVariableChange,
      handleTemplateChange,
      handleVersionChange,
      handleAttachmentsChange,
      handleToggleImmediate,
      handleSubmit,
    },
  };
}