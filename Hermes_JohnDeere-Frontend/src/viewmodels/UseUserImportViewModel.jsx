import { useState, useRef, useCallback } from "react";
import { apiClient } from "../core/api/apiClient";
import { ENDPOINTS } from "../core/constants/appConstants";

/**
 * @typedef {"idle"|"preview"|"result"} ImportStage
 *
 * @typedef {Object} PreviewRow
 * @property {number}  index   - Índice 1-based da linha
 * @property {string}  name
 * @property {string}  email
 * @property {string}  role
 * @property {boolean} valid
 * @property {string}  [error] - Motivo da falha client-side
 *
 * @typedef {Object} RowFailure
 * @property {number} rowIndex
 * @property {string} email
 * @property {string} errorReason
 *
 * @typedef {Object} ImportResult
 * @property {number}       totalRows
 * @property {number}       successCount
 * @property {number}       failureCount
 * @property {string[]}     successfulUsers
 * @property {RowFailure[]} failures
 */

const VALID_ROLES = ["ADMIN", "USER"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".json"];

// ─── Validação client-side de uma linha ──────────────────────────────────────

function validateRow(row, index) {
  const errors = [];

  if (!row.name || row.name.trim().length < 2) {
    errors.push("Nome inválido (mínimo 2 caracteres)");
  }

  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.push("E-mail inválido");
  }

  if (!row.role || !VALID_ROLES.includes(row.role.trim().toUpperCase())) {
    errors.push(`Role inválida — use: ${VALID_ROLES.join(", ")}`);
  }

  return {
    index,
    name:  (row.name  ?? "").trim(),
    email: (row.email ?? "").trim(),
    role:  (row.role  ?? "").trim().toUpperCase(),
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("O arquivo CSV está vazio ou sem dados");

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^\uFEFF/, ""));

  const nameIdx  = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const roleIdx  = headers.indexOf("role");

  const missing = ["name", "email", "role"].filter(
    (c) => !headers.includes(c)
  );
  if (missing.length > 0) {
    throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}`);
  }

  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim());
    return validateRow(
      {
        name:  cols[nameIdx]  ?? "",
        email: cols[emailIdx] ?? "",
        role:  cols[roleIdx]  ?? "",
      },
      i + 1
    );
  });
}

function parseJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON inválido — verifique a estrutura do arquivo");
  }
  if (!Array.isArray(data)) {
    throw new Error("O JSON deve conter um array de objetos");
  }
  return data.map((row, i) => validateRow(row, i + 1));
}

// ─── ViewModel ────────────────────────────────────────────────────────────────

/**
 * ViewModel para a importação em massa de usuários.
 *
 * Gerencia 3 etapas: idle → preview → result.
 * O parsing e validação client-side ocorrem ao selecionar o arquivo (etapa preview),
 * permitindo que o usuário corrija erros antes de submeter ao backend.
 *
 * Localização: src/viewmodels/useUserImportViewModel.js
 */
export function useUserImportViewModel() {
  const [stage, setStage]               = useState(/** @type {ImportStage} */ ("idle"));
  const [selectedFile, setSelectedFile] = useState(/** @type {File|null} */ (null));
  const [previewRows, setPreviewRows]   = useState(/** @type {PreviewRow[]} */ ([]));
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState(/** @type {string|null} */ (null));
  const [result, setResult]             = useState(/** @type {ImportResult|null} */ (null));

  const abortRef = useRef(/** @type {AbortController|null} */ (null));

  // ── Validação do arquivo ────────────────────────────────────────────────

  const validateFile = useCallback((file) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return "Tipo não suportado. Envie um arquivo .csv ou .json";
    }
    if (file.size > MAX_SIZE_BYTES) return "O arquivo excede o limite de 5 MB";
    if (file.size === 0) return "O arquivo está vazio";
    return null;
  }, []);

  // ── Parsing + preview (client-side) ────────────────────────────────────

  const processFile = useCallback(async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);

    try {
      const text = await file.text();
      const ext  = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const rows = ext === ".csv" ? parseCsv(text) : parseJson(text);

      setPreviewRows(rows);
      setStage("preview");
    } catch (err) {
      setError(err.message ?? "Falha ao processar o arquivo");
      setSelectedFile(null);
    }
  }, [validateFile]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Importação (backend) ────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

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
          signal: abortRef.current.signal,
        }
      );

      setResult(response.data);
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

  // ── Navegação entre etapas ──────────────────────────────────────────────

  const goBack = useCallback(() => {
    setStage("idle");
    setSelectedFile(null);
    setPreviewRows([]);
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setStage("idle");
    setSelectedFile(null);
    setPreviewRows([]);
    setIsLoading(false);
    setError(null);
    setResult(null);
  }, []);

  // ── Derivados ───────────────────────────────────────────────────────────

  const validRows   = previewRows.filter((r) => r.valid);
  const invalidRows = previewRows.filter((r) => !r.valid);

  return {
    stage,
    selectedFile,
    previewRows,
    validRows,
    invalidRows,
    isLoading,
    error,
    result,
    handleFileSelect,
    handleDrop,
    handleImport,
    goBack,
    handleReset,
  };
}
