import { useState, useEffect, useMemo, useCallback } from 'react';
import { templateService } from '../services/templateService';
import { notificationService } from '../services/notificationService';
import { getLatestVersion } from '../models/Template';

/** Tamanho máximo do arquivo de destinatários: 5 MB. */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Número máximo de destinatários por arquivo. */
const MAX_RECORDS = 200;

/** Extensões de arquivo aceitas. */
const ACCEPTED_EXTENSIONS = ['.csv', '.json'];

/**
 * Gera e força o download de um arquivo de template (CSV ou JSON) contendo
 * as colunas correspondentes às variáveis do template selecionado, mais a
 * coluna obrigatória `email`.
 *
 * @param {'csv' | 'json'} format - Formato do arquivo a gerar
 * @param {string[]} variables    - Lista de variáveis do template selecionado
 * @param {string} templateName   - Nome do template, usado como nome do arquivo
 */
function downloadTemplateFile(format, variables, templateName) {
  const columns = ['email', ...variables];
  const safeName = (templateName ?? 'template').replace(/\s+/g, '_').toLowerCase();

  let content;
  let mimeType;
  let extension;

  if (format === 'csv') {
    const header = columns.join(',');
    const example = columns.map((col) => (col === 'email' ? 'destinatario@exemplo.com' : col)).join(',');
    content  = `${header}\n${example}\n`;
    mimeType = 'text/csv;charset=utf-8;';
    extension = 'csv';
  } else {
    const exampleObj = Object.fromEntries(
      columns.map((col) => [col, col === 'email' ? 'destinatario@exemplo.com' : col])
    );
    content   = JSON.stringify([exampleObj], null, 2);
    mimeType  = 'application/json;charset=utf-8;';
    extension = 'json';
  }

  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `hermes_bulk_${safeName}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * ViewModel para a página de envio em massa de notificações.
 *
 * Gerencia todo o estado e lógica da BulkNotificationPage sem expor
 * nenhum detalhe de implementação à camada de View. Retorno flat
 * (sem agrupamento state/actions) seguindo o padrão do projeto.
 *
 * Fluxo:
 * 1. Usuário seleciona template → versões e variáveis são carregadas
 * 2. Usuário baixa o template CSV/JSON gerado dinamicamente com as colunas do template
 * 3. Usuário faz upload do arquivo preenchido
 * 4. Frontend valida tipo, tamanho e presença do template
 * 5. Formulário é enviado para POST /notifications/bulk
 * 6. Resultado é exibido linha a linha (sucesso / falha com motivo)
 *
 * @returns {{
 *   templateId: string,
 *   templateVersionId: string,
 *   scheduledAt: string,
 *   isImmediate: boolean,
 *   file: File | null,
 *   templates: object[],
 *   selectedTemplate: object | null,
 *   selectedVersion: object | null,
 *   availableVersions: object[],
 *   requiredVariables: string[],
 *   isLoadingTemplates: boolean,
 *   isSending: boolean,
 *   result: import('../dto/notification/BulkNotificationResultDTO').BulkNotificationResultDTO | null,
 *   error: string | null,
 *   fieldErrors: Record<string, string>,
 *   handleTemplateChange: (id: string) => Promise<void>,
 *   handleVersionChange: (id: string) => void,
 *   handleFileChange: (file: File | null) => void,
 *   handleScheduledAtChange: (value: string) => void,
 *   handleToggleImmediate: () => void,
 *   handleDownloadTemplate: (format: 'csv' | 'json') => void,
 *   handleSubmit: () => Promise<void>,
 *   handleReset: () => void,
 * }}
 */
export function useBulkNotificationViewModel() {
  // ── Form state ────────────────────────────────────────────────────────────
  const [templateId, setTemplateId]               = useState('');
  const [templateVersionId, setTemplateVersionId] = useState('');
  const [scheduledAt, setScheduledAt]             = useState('');
  const [isImmediate, setIsImmediate]             = useState(true);
  const [file, setFile]                           = useState(null);

  // ── Data state ────────────────────────────────────────────────────────────
  const [templates, setTemplates]               = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [availableVersions, setAvailableVersions] = useState([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSending, setIsSending]                   = useState(false);
  const [result, setResult]                         = useState(null);
  const [error, setError]                           = useState(null);
  const [fieldErrors, setFieldErrors]               = useState({});

  // ── Derivados ─────────────────────────────────────────────────────────────
  const selectedVersion = useMemo(
    () => availableVersions.find((v) => v.id === templateVersionId) ?? null,
    [availableVersions, templateVersionId]
  );

  const requiredVariables = useMemo(
    () => (Array.isArray(selectedVersion?.variables) ? selectedVersion.variables : []),
    [selectedVersion]
  );

  // ── Carregamento inicial de templates ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setIsLoadingTemplates(true);
      setError(null);
      try {
        const result = await templateService.listTemplates({ page: 1, limit: 999 });
        if (!cancelled) setTemplates(result.data ?? []);
      } catch (err) {
        if (cancelled) return;
        console.error('[useBulkNotificationViewModel] Erro ao carregar templates:', err?.details ?? err);
        setError(err?.message ?? 'Erro ao carregar lista de templates.');
      } finally {
        if (!cancelled) setIsLoadingTemplates(false);
      }
    }

    loadTemplates();
    return () => { cancelled = true; };
  }, []);

  // ── Ações ─────────────────────────────────────────────────────────────────

  /**
   * Seleciona um template pelo ID, carrega suas versões e pré-seleciona a mais recente.
   * Limpa o arquivo selecionado ao trocar de template, pois as colunas mudam.
   *
   * @param {string} id - UUID do template selecionado
   */
  const handleTemplateChange = useCallback(async (id) => {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, templateId: '' }));
    setTemplateId(id);
    setTemplateVersionId('');
    setSelectedTemplate(null);
    setAvailableVersions([]);
    setFile(null);
    setResult(null);

    if (!id) return;

    setIsLoadingTemplates(true);
    try {
      const template = await templateService.getTemplate(id);
      const versions = Array.isArray(template.versions) ? template.versions : [];

      setSelectedTemplate(template);
      setAvailableVersions(versions);

      const latest = getLatestVersion(template);
      if (latest) setTemplateVersionId(latest.id);
    } catch (err) {
      console.error('[useBulkNotificationViewModel] Erro ao carregar template:', err?.details ?? err);
      setError(err?.message ?? 'Erro ao carregar versões do template.');
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  /**
   * Seleciona uma versão específica do template.
   * Limpa o arquivo pois as variáveis podem diferir entre versões.
   *
   * @param {string} id - UUID da versão selecionada
   */
  const handleVersionChange = useCallback((id) => {
    setTemplateVersionId(id);
    setFile(null);
    setResult(null);
    setFieldErrors((prev) => ({ ...prev, templateVersionId: '' }));
  }, []);

  /**
   * Registra o arquivo selecionado e valida tipo e tamanho imediatamente,
   * exibindo erro de campo antes do submit para melhor UX.
   *
   * @param {File | null} selectedFile - Arquivo escolhido pelo usuário
   */
  const handleFileChange = useCallback((selectedFile) => {
    setError(null);
    setResult(null);
    setFieldErrors((prev) => ({ ...prev, file: '' }));

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const name = selectedFile.name.toLowerCase();
    const validExtension = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));

    if (!validExtension) {
      setFieldErrors((prev) => ({
        ...prev,
        file: 'Formato inválido. Envie um arquivo .csv ou .json.',
      }));
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        file: `Arquivo muito grande. O limite é 5 MB (arquivo tem ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB).`,
      }));
      setFile(null);
      return;
    }

    setFile(selectedFile);
  }, []);

  /**
   * Atualiza a data/hora de agendamento.
   *
   * @param {string} value - Valor do input datetime-local
   */
  const handleScheduledAtChange = useCallback((value) => {
    setScheduledAt(value);
    setFieldErrors((prev) => ({ ...prev, scheduledAt: '' }));
  }, []);

  /**
   * Alterna entre envio imediato e agendado.
   * Limpa o campo scheduledAt ao voltar para imediato.
   */
  const handleToggleImmediate = useCallback(() => {
    setIsImmediate((prev) => {
      if (!prev) setScheduledAt('');
      return !prev;
    });
    setFieldErrors((prev) => ({ ...prev, scheduledAt: '' }));
  }, []);

  /**
   * Gera e força o download de um arquivo de template (CSV ou JSON) com as
   * colunas do template selecionado mais a coluna obrigatória `email`.
   *
   * @param {'csv' | 'json'} format - Formato desejado
   */
  const handleDownloadTemplate = useCallback((format) => {
    if (!selectedVersion) return;
    downloadTemplateFile(format, requiredVariables, selectedTemplate?.name ?? 'template');
  }, [selectedVersion, requiredVariables, selectedTemplate]);

  /**
   * Valida o formulário e envia o arquivo para POST /notifications/bulk.
   * Erros individuais por linha são exibidos no resultado — não param o processamento.
   */
  const handleSubmit = useCallback(async () => {
    setError(null);
    setResult(null);

    // Validação local
    const errors = {};

    if (!templateId) {
      errors.templateId = 'Selecione um template.';
    }

    if (!file) {
      errors.file = 'Selecione um arquivo CSV ou JSON.';
    }

    if (!isImmediate && !scheduledAt) {
      errors.scheduledAt = 'Informe a data e hora de envio.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSending(true);

    try {
      const formData = new FormData();
      formData.append('templateId', templateId);
      if (templateVersionId) formData.append('templateVersionId', templateVersionId);
      formData.append('channel', selectedTemplate?.channel ?? 'EMAIL');
      formData.append('file', file);
      if (!isImmediate && scheduledAt) {
        // Converte datetime-local para ISO-8601 com offset local
        formData.append('scheduledAt', new Date(scheduledAt).toISOString());
      }

      const bulkResult = await notificationService.sendBulkNotification(formData);
      setResult(bulkResult);
    } catch (err) {
      console.error('[useBulkNotificationViewModel] Erro no envio em massa:', err?.details ?? err);
      setError(err?.message ?? 'Erro ao processar o envio em massa.');
    } finally {
      setIsSending(false);
    }
  }, [templateId, templateVersionId, file, isImmediate, scheduledAt, selectedTemplate]);

  /**
   * Reinicia o formulário para um novo envio em massa, preservando os templates carregados.
   */
  const handleReset = useCallback(() => {
    setTemplateId('');
    setTemplateVersionId('');
    setScheduledAt('');
    setIsImmediate(true);
    setFile(null);
    setSelectedTemplate(null);
    setAvailableVersions([]);
    setResult(null);
    setError(null);
    setFieldErrors({});
  }, []);

  return {
    // Form
    templateId,
    templateVersionId,
    scheduledAt,
    isImmediate,
    file,
    // Data
    templates,
    selectedTemplate,
    selectedVersion,
    availableVersions,
    requiredVariables,
    // UI
    isLoadingTemplates,
    isSending,
    result,
    error,
    fieldErrors,
    // Actions
    handleTemplateChange,
    handleVersionChange,
    handleFileChange,
    handleScheduledAtChange,
    handleToggleImmediate,
    handleDownloadTemplate,
    handleSubmit,
    handleReset,
  };
}
