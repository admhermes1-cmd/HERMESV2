import { useState, useRef, useCallback } from "react";
import apiClient from "../core/api/apiClient";
import { ENDPOINTS } from "../core/constants/appConstants";

/**
 * @typedef {Object} RowFailure
 * @property {number} rowIndex    - Índice 1-based da linha com falha
 * @property {string} email       - E-mail da linha (pode ser inválido)
 * @property {string} errorReason - Motivo da falha
 */

/**
 * @typedef {Object} BulkImportResult
 * @property {number}       totalRows       - Total de linhas no arquivo
 * @property {number}       successCount    - Usuários criados com sucesso
 * @property {number}       failureCount    - Linhas que falharam
 * @property {string[]}     successfulUsers - E-mails criados com sucesso
 * @property {RowFailure[]} failures        - Detalhes das linhas com erro
 */

/**
 * @typedef {Object} UseUserImportViewModel
 * @property {File|null}             selectedFile     - Arquivo selecionado pelo usuário
 * @property {boolean}               isLoading        - Estado de carregamento durante o upload
 * @property {string|null}           error            - Mensagem de erro global
 * @property {BulkImportResult|null} result           - Resultado consolidado da importação
 * @property {"idle"|"result"}       stage            - Etapa atual do fluxo do modal
 * @property {Function}              handleFileSelect  - Callback para seleção de arquivo
 * @property {Function}              handleDrop        - Callback para drag-and-drop
 * @property {Function}              handleImport      - Dispara o upload e importação
 * @property {Function}              handleReset       - Volta ao estado inicial
 * @property {Function}              cancel            - Cancela requisição em voo
 */

/**
 * ViewModel para a funcionalidade de importação em massa de usuários.
 *
 * Encapsula toda a lógica de seleção de arquivo, validação client-side,
 * envio multipart ao backend e gerenciamento do resultado parcial (partial-commit).
 *
 * Localização: src/viewmodels/useUserImportViewModel.js
 *
 * @returns {UseUserImportViewModel}
 */
export function useUserImportViewModel() {
  const [selectedFile, setSelectedFile] = useState(/** @type {File|null} */ (null));
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState(/** @type {string|null} */ (null));
  const [result, setResult]             = useState(/** @type {BulkImportResult|null} */ (null));
  const [stage, setStage]               = useState(/** @type {"idle"|"result"} */ ("idle"));

  const abortControllerRef = useRef(/** @type {AbortController|null} */ (null));

  // ---------------------------------------------------------------------------
  // File validation
  // ---------------------------------------------------------------------------

  /**
   * Valida o arquivo selecionado quanto a tipo e tamanho.
   * @param {File} file
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  const validateFile = useCallback((file) => {
    const ALLOWED_EXTENSIONS = [".csv", ".json"];
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return "Tipo de arquivo não suportado. Envie um arquivo .csv ou .json";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return "O arquivo excede o tamanho máximo de 5 MB";
    }
    if (file.size === 0) {
      return "O arquivo está vazio";
    }
    return null;
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Processa a seleção de arquivo via input[type=file].
   * @param {React.ChangeEvent<HTMLInputElement>} e
   */
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }, [validateFile]);

  /**
   * Processa arquivo arrastado para a drop zone.
   * @param {React.DragEvent<HTMLDivElement>} e
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }, [validateFile]);

  /**
   * Envia o arquivo selecionado para o endpoint de importação em massa.
   * Usa FormData para envio multipart/form-data.
   */
  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      setError("Selecione um arquivo antes de importar");
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await apiClient.post(
        ENDPOINTS.USERS.BULK_IMPORT,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          signal: abortControllerRef.current.signal,
        }
      );

      setResult(response);
      setStage("result");
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;

      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Falha ao processar a importação. Tente novamente.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile]);

  /** Reseta o ViewModel para o estado inicial, permitindo nova importação. */
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    setResult(null);
    setStage("idle");
  }, []);

  /** Cancela a requisição HTTP em voo (se houver). */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    selectedFile,
    isLoading,
    error,
    result,
    stage,
    handleFileSelect,
    handleDrop,
    handleImport,
    handleReset,
    cancel,
  };
}