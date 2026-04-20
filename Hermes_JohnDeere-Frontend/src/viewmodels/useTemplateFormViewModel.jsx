import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { templateService } from '../services/Templateservice';
import { getLatestVersion } from '../models/Template';
import { TEMPLATE } from '../core/constants/Appconstants';

/** Estrutura inicial de um formulário de template vazio */
const EMPTY_FORM = {
  name: '',
  description: '',
  channel: '',
};

/** Estrutura inicial de uma nova versão de template */
const EMPTY_VERSION = {
  subject: '',
  body: '',
  variables: [],
};

/**
 * Extrai variáveis dinâmicas de um string de body de template.
 * Utiliza o regex definido em appConstants.TEMPLATE.VARIABLE_REGEX.
 * @param {string} body
 * @returns {string[]} Lista de nomes de variáveis únicas encontradas
 */
function extractVariables(body = '') {
  const regex = new RegExp(TEMPLATE.VARIABLE_REGEX, 'g');
  const matches = [...body.matchAll(regex)];
  const unique = [...new Set(matches.map((m) => m[1] ?? m[0]))];
  return unique;
}

/**
 * ViewModel para o formulário de Template (criação e edição).
 *
 * Detecta automaticamente o modo pelo parâmetro de rota `id`:
 * - Ausente → modo criação
 * - Presente → modo edição (carrega template + versões)
 *
 * @returns {{
 *   state: {
 *     form: { name: string, description: string, channel: string },
 *     versions: import('../models/Template').TemplateVersion[],
 *     selectedVersion: import('../models/Template').TemplateVersion | null,
 *     extractedVariables: string[],
 *     isEditing: boolean,
 *     isLoading: boolean,
 *     isSaving: boolean,
 *     error: string | null
 *   },
 *   actions: {
 *     handleChange: (field: string, value: string) => void,
 *     handleVersionChange: (versionId: string) => void,
 *     handleVersionFieldChange: (field: string, value: string) => void,
 *     handleSubmit: () => Promise<boolean>,
 *     handleAddVersion: () => void,
 *     handleSaveVersion: (versionId: string) => Promise<boolean>
 *   }
 * }}
 */
export function useTemplateFormViewModel() {
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isLoading, setIsLoading] = useState(isEditing); // só carrega se for edição
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // ---------- Variáveis extraídas dinamicamente do body da versão selecionada ----------
  const extractedVariables = useMemo(
    () => extractVariables(selectedVersion?.body ?? ''),
    [selectedVersion?.body]
  );

  // ---------- Carregamento inicial no modo edição ----------
  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const template = await templateService.getTemplate(id);
        if (cancelled) return;

        setForm({
          name: template.name ?? '',
          description: template.description ?? '',
          channel: template.channel ?? '',
        });

        const versionList = Array.isArray(template.versions) ? template.versions : [];
        setVersions(versionList);

        // Pré-seleciona a versão mais recente
        const latest = getLatestVersion(template);
        setSelectedVersion(latest ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err?.details) {
          console.error('[useTemplateFormViewModel] Erro ao carregar template:', err.details);
        }
        setError(err?.message ?? 'Erro ao carregar template.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing]);

  // ---------- Ações ----------

  /**
   * Atualiza um campo do formulário principal do template.
   * @param {string} field
   * @param {string} value
   */
  function handleChange(field, value) {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Seleciona uma versão diferente pelo ID para visualização/edição.
   * @param {string} versionId
   */
  function handleVersionChange(versionId) {
    const found = versions.find((v) => v.id === versionId) ?? null;
    setSelectedVersion(found);
  }

  /**
   * Atualiza um campo da versão atualmente selecionada (estado local, não persiste ainda).
   * @param {string} field
   * @param {string} value
   */
  function handleVersionFieldChange(field, value) {
    setSelectedVersion((prev) => (prev ? { ...prev, [field]: value } : prev));
    // Espelha a alteração também na lista de versões
    setVersions((prev) =>
      prev.map((v) => (v.id === selectedVersion?.id ? { ...v, [field]: value } : v))
    );
  }

  /**
   * Cria ou atualiza o template (dados principais). Retorna `true` em sucesso.
   * A navegação pós-save é responsabilidade da View.
   * @returns {Promise<boolean>}
   */
  async function handleSubmit() {
    setIsSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await templateService.updateTemplate(id, form);
      } else {
        await templateService.createTemplate(form);
      }
      return true;
    } catch (err) {
      if (err?.details) {
        console.error('[useTemplateFormViewModel] Erro ao salvar template:', err.details);
      }
      setError(err?.message ?? 'Erro ao salvar template.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Adiciona uma nova versão vazia ao estado local para edição imediata.
   * A versão será persistida ao chamar `handleSaveVersion`.
   */
  function handleAddVersion() {
    const draft = {
      ...EMPTY_VERSION,
      id: `draft_${Date.now()}`, // ID temporário para controle de estado local
      isDraft: true,
    };
    setVersions((prev) => [...prev, draft]);
    setSelectedVersion(draft);
  }

  /**
   * Persiste uma versão específica no backend (cria ou atualiza).
   * @param {string} versionId - ID da versão (pode ser um ID de draft)
   * @returns {Promise<boolean>}
   */
  async function handleSaveVersion(versionId) {
    const version = versions.find((v) => v.id === versionId);
    if (!version) return false;

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        subject: version.subject,
        body: version.body,
      };

      let saved;

      if (version.isDraft) {
        // Nova versão: só pode criar versão se o template já existir
        if (!id) {
          setError('Salve o template antes de adicionar versões.');
          return false;
        }
        saved = await templateService.createVersion(id, payload);
      } else {
        saved = await templateService.updateVersion(id, versionId, payload);
      }

      // Substitui o draft/versão antiga pela resposta do servidor
      setVersions((prev) =>
        prev.map((v) => (v.id === versionId ? { ...saved, isDraft: false } : v))
      );

      // Mantém a seleção apontando para a versão salva
      if (selectedVersion?.id === versionId) {
        setSelectedVersion({ ...saved, isDraft: false });
      }

      return true;
    } catch (err) {
      if (err?.details) {
        console.error('[useTemplateFormViewModel] Erro ao salvar versão:', err.details);
      }
      setError(err?.message ?? 'Erro ao salvar versão.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    state: {
      form,
      versions,
      selectedVersion,
      extractedVariables,
      isEditing,
      isLoading,
      isSaving,
      error,
    },
    actions: {
      handleChange,
      handleVersionChange,
      handleVersionFieldChange,
      handleSubmit,
      handleAddVersion,
      handleSaveVersion,
    },
  };
}