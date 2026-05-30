import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { templateService } from '../services/templateService';
import { getLatestVersion } from '../models/Template';
import { TEMPLATE } from '../core/constants/appConstants';

const EMPTY_FORM = { name: '', description: '', channel: 'EMAIL' };
const EMPTY_VERSION = { subject: '', body: '', variables: [] };

/**
 * Extrai variáveis únicas do body usando TEMPLATE.VARIABLE_PATTERN.
 * ATENÇÃO: VARIABLE_PATTERN é um RegExp com flag /g — requer reset de lastIndex
 * antes de cada uso para evitar resultados inconsistentes entre chamadas.
 * @param {string} body
 * @returns {string[]}
 */
function extractVariables(body = '') {
  // Cria nova instância para evitar problema de estado compartilhado da flag /g
  const regex = new RegExp(TEMPLATE.VARIABLE_PATTERN.source, 'g');
  const matches = [...body.matchAll(regex)];
  return [...new Set(matches.map((m) => m[1] ?? m[0]))];
}

/**
 * ViewModel para criação e edição de Templates.
 *
 * Retorno FLAT: a TemplateFormPage desestrutura todos os campos diretamente.
 *
 * Expõe `isEditMode` (não `isEditing`) para corresponder exatamente ao nome
 * usado pela TemplateFormPage.
 *
 * Em modo criação, o fluxo em etapas é controlado pela View via `currentStep`.
 * A operação de persistência atômica (template + versão juntos) é feita por
 * `handleCreateWithVersion`, que encapsula as duas chamadas sequenciais e
 * evita expor o id intermediário à camada de View.
 *
 * @returns {{
 *   form: { name: string, description: string, channel: string },
 *   versions: object[],
 *   selectedVersion: object | null,
 *   extractedVariables: string[],
 *   isEditMode: boolean,
 *   isLoading: boolean,
 *   isSaving: boolean,
 *   error: string | null,
 *   handleChange: (field: string, value: string) => void,
 *   handleVersionChange: (versionId: string) => void,
 *   handleVersionFieldChange: (field: string, value: string) => void,
 *   handleSubmit: () => Promise<boolean>,
 *   handleAddVersion: () => void,
 *   handleSaveVersion: (versionId: string) => Promise<boolean>,
 *   handleCreateWithVersion: () => Promise<boolean>
 * }}
 */
export function useTemplateFormViewModel() {
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm]                       = useState(EMPTY_FORM);
  const [versions, setVersions]               = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isLoading, setIsLoading]             = useState(isEditMode);
  const [isSaving, setIsSaving]               = useState(false);
  const [error, setError]                     = useState(null);

  const extractedVariables = useMemo(
    () => extractVariables(selectedVersion?.body ?? ''),
    [selectedVersion?.body]
  );

  // Carregamento inicial no modo edição
  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const template = await templateService.getTemplate(id);
        if (cancelled) return;

        setForm({
          name:        template.name        ?? '',
          description: template.description ?? '',
          channel:     template.channel     ?? 'EMAIL',
        });

        const versionList = Array.isArray(template.versions) ? template.versions : [];
        setVersions(versionList);

        const latest = getLatestVersion(template);
        setSelectedVersion(latest ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err?.details) console.error('[useTemplateFormViewModel] erro ao carregar:', err.details);
        setError(err?.message ?? 'Erro ao carregar template.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, isEditMode]);

  function handleChange(field, value) {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleVersionChange(versionId) {
    const found = versions.find((v) => v.id === versionId) ?? null;
    setSelectedVersion(found);
  }

  function handleVersionFieldChange(field, value) {
    setSelectedVersion((prev) => (prev ? { ...prev, [field]: value } : prev));
    setVersions((prev) =>
      prev.map((v) => (v.id === selectedVersion?.id ? { ...v, [field]: value } : v))
    );
  }

  /**
   * Salva os metadados do template (nome, descrição, canal).
   * Usado exclusivamente em modo edição para atualizar metadados.
   * Em criação, preferir `handleCreateWithVersion`.
   * Navegação pós-save é responsabilidade da View.
   * @returns {Promise<boolean>}
   */
  async function handleSubmit() {
    setIsSaving(true);
    setError(null);

    try {
      if (isEditMode) {
        await templateService.updateTemplate(id, form);
      } else {
        await templateService.createTemplate(form);
      }
      return true;
    } catch (err) {
      if (err?.details) console.error('[useTemplateFormViewModel] erro ao salvar:', err.details);
      setError(err?.message ?? 'Erro ao salvar template.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Operação atômica de criação: persiste template (metadados) e primeira
   * versão em sequência, usando o id retornado pelo backend como elo entre
   * as duas chamadas.
   *
   * Aplicável **apenas em modo criação** (`isEditMode === false`).
   * A View é responsável por garantir que `selectedVersion` exista e tenha
   * `body` preenchido antes de chamar esta função.
   *
   * @returns {Promise<boolean>} true em caso de sucesso total; false se
   *   qualquer etapa falhar (erro exposto via `error`).
   *
   * @example
   * const ok = await handleCreateWithVersion();
   * if (ok) navigate(ROUTES.TEMPLATES);
   */
  async function handleCreateWithVersion() {
    if (!selectedVersion?.body?.trim()) {
      setError('O corpo da mensagem é obrigatório.');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 1. Criar o template — backend retorna o objeto com id
      const createdTemplate = await templateService.createTemplate(form);
      const newId = createdTemplate?.id;

      if (!newId) {
        setError('Resposta inesperada do servidor ao criar template.');
        return false;
      }

      // 2. Criar a primeira versão usando o id recém-obtido
      const versionPayload = {
        subject:   selectedVersion.subject ?? '',
        body:      selectedVersion.body,
        variables: extractVariables(selectedVersion.body),
      };
      await templateService.createVersion(newId, versionPayload);

      return true;
    } catch (err) {
      if (err?.details) console.error('[useTemplateFormViewModel] erro em handleCreateWithVersion:', err.details);
      setError(err?.message ?? 'Erro ao salvar template.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Adiciona uma versão draft local. Persiste com handleSaveVersion.
   */
  function handleAddVersion() {
    const draft = {
      ...EMPTY_VERSION,
      id:      `draft_${Date.now()}`,
      isDraft: true,
    };
    setVersions((prev) => [...prev, draft]);
    setSelectedVersion(draft);
  }

  /**
   * Persiste uma versão (cria ou atualiza).
   * @param {string} versionId
   * @returns {Promise<boolean>}
   */
  async function handleSaveVersion(versionId) {
    const version = versions.find((v) => v.id === versionId);
    if (!version) return false;

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        subject:   version.subject,
        body:      version.body,
        variables: extractVariables(version.body),
      };
      let saved;

      if (version.isDraft) {
        if (!id) {
          setError('Salve o template antes de adicionar versões.');
          return false;
        }
        saved = await templateService.createVersion(id, payload);
      } else {
        saved = await templateService.updateVersion(id, versionId, payload);
      }

      const normalized = { ...saved, isDraft: false };
      setVersions((prev) => prev.map((v) => (v.id === versionId ? normalized : v)));
      if (selectedVersion?.id === versionId) setSelectedVersion(normalized);

      return true;
    } catch (err) {
      if (err?.details) console.error('[useTemplateFormViewModel] erro ao salvar versão:', err.details);
      setError(err?.message ?? 'Erro ao salvar versão.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    form,
    versions,
    selectedVersion,
    extractedVariables,
    isEditMode,
    isLoading,
    isSaving,
    error,
    handleChange,
    handleVersionChange,
    handleVersionFieldChange,
    handleSubmit,
    handleAddVersion,
    handleSaveVersion,
    handleCreateWithVersion,
  };
}
