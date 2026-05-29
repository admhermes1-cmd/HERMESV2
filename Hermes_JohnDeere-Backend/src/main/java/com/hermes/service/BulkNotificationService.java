package com.hermes.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.dto.notification.BulkNotificationResultDTO;
import com.hermes.dto.notification.BulkNotificationResultDTO.BulkFailureItem;
import com.hermes.dto.notification.BulkNotificationResultDTO.BulkSuccessItem;
import com.hermes.dto.notification.NotificationRequestDTO;
import com.hermes.dto.notification.NotificationRequestDTO.RecipientsDTO;
import com.hermes.exception.AppException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service responsável pelo processamento de envios em massa de notificações via
 * arquivos CSV ou JSON.
 *
 * <p><b>Princípio fundamental:</b> este service NÃO implementa nenhuma lógica de
 * envio de e-mail. Todo o envio real é delegado ao {@link NotificationService#createNotification}
 * já existente, que por sua vez aciona o {@code EmailService}. Este service atua
 * exclusivamente como um adaptador de formato de entrada (CSV/JSON → DTO).</p>
 *
 * <p><b>Isolamento por registro:</b> cada linha do arquivo é processada de forma
 * independente. Uma falha em um destinatário não interrompe o processamento dos
 * demais. Não há {@code @Transactional} no nível do lote — a transação de cada
 * notificação é gerenciada pelo próprio {@link NotificationService}.</p>
 *
 * <p><b>Formato CSV esperado:</b></p>
 * <pre>
 * email,nome,empresa
 * joao@exemplo.com,João Silva,Acme Corp
 * maria@exemplo.com,Maria Santos,Tech Co
 * </pre>
 *
 * <p><b>Formato JSON esperado:</b></p>
 * <pre>
 * [
 *   { "email": "joao@exemplo.com", "nome": "João Silva", "empresa": "Acme Corp" },
 *   { "email": "maria@exemplo.com", "nome": "Maria Santos", "empresa": "Tech Co" }
 * ]
 * </pre>
 *
 * @see NotificationService
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkNotificationService {

    /** Limite máximo de destinatários por operação de envio em massa. */
    private static final int MAX_RECORDS = 200;

    /** Tamanho máximo do arquivo em bytes (5 MB). */
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;

    /** Coluna obrigatória em todos os arquivos de envio em massa. */
    private static final String EMAIL_COLUMN = "email";

    /** Coluna opcional usada para exibição no relatório de resultado. */
    private static final String NAME_COLUMN = "nome";

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    /**
     * Processa um arquivo CSV ou JSON de destinatários e executa o envio em massa.
     *
     * <p>O método determina o formato do arquivo pela extensão do nome original
     * ({@code .csv} ou {@code .json}) e delega o parsing ao método apropriado.
     * Em seguida, itera sobre cada registro, monta um {@link NotificationRequestDTO}
     * e chama {@link NotificationService#createNotification} para cada um.</p>
     *
     * <p>Erros individuais são capturados e acumulados em {@code failures} sem
     * interromper o loop — o cliente recebe um relatório completo ao final.</p>
     *
     * @param templateId        identificador do template a ser utilizado em todos os envios
     * @param templateVersionId identificador da versão específica do template; se
     *                          {@code null}, o NotificationService usa a versão ativa mais recente
     * @param channel           canal de envio (ex: {@code EMAIL}); propagado a cada {@link NotificationRequestDTO}
     * @param scheduledAt       data/hora de agendamento, ou {@code null} para envio imediato
     * @param file              arquivo CSV ou JSON com os destinatários e variáveis do template
     * @param createdBy         UUID do usuário autenticado que disparou a operação
     * @return {@link BulkNotificationResultDTO} com totais e detalhes de sucesso/falha
     * @throws AppException se o arquivo for inválido, vazio, exceder o tamanho ou o limite de registros
     */
    public BulkNotificationResultDTO processBulkNotification(
            UUID templateId,
            UUID templateVersionId,
            String channel,
            OffsetDateTime scheduledAt,
            MultipartFile file,
            UUID createdBy
    ) {
        validateFile(file);

        String filename = file.getOriginalFilename() != null
                ? file.getOriginalFilename().toLowerCase()
                : "";

        List<Map<String, String>> records;

        if (filename.endsWith(".csv")) {
            records = parseCsv(file);
        } else if (filename.endsWith(".json")) {
            records = parseJson(file);
        } else {
            throw AppException.bulkInvalidFormat();
        }

        if (records.isEmpty()) {
            throw AppException.bulkEmptyFile();
        }

        if (records.size() > MAX_RECORDS) {
            throw AppException.bulkTooManyRecords(MAX_RECORDS);
        }

        log.info("[BulkNotification] Iniciando envio em massa: {} registros, templateId={}, createdBy={}",
                records.size(), templateId, createdBy);

        List<BulkSuccessItem> successes = new ArrayList<>();
        List<BulkFailureItem> failures  = new ArrayList<>();

        for (int i = 0; i < records.size(); i++) {
            int lineNumber = i + 1;
            Map<String, String> record = records.get(i);

            String email = record.get(EMAIL_COLUMN);

            if (email == null || email.isBlank()) {
                failures.add(new BulkFailureItem(lineNumber, null,
                        "Coluna 'email' ausente ou vazia"));
                log.warn("[BulkNotification] Linha {}: email ausente", lineNumber);
                continue;
            }

            email = email.trim();

            try {
                // Monta o mapa de variáveis excluindo a coluna reservada 'email'
                Map<String, String> variables = new HashMap<>(record);
                variables.remove(EMAIL_COLUMN);

                NotificationRequestDTO request = buildRequest(
                        templateId, templateVersionId, channel,
                        email, variables, scheduledAt
                );

                // Delega integralmente ao NotificationService existente —
                // sem duplicar lógica de envio, validação de template ou SMTP.
                notificationService.createNotification(request, List.of(), createdBy);

                String name = record.getOrDefault(NAME_COLUMN, null);
                successes.add(new BulkSuccessItem(lineNumber, email, name));

                log.debug("[BulkNotification] Linha {}: enviado com sucesso para {}", lineNumber, email);

            } catch (AppException ex) {
                failures.add(new BulkFailureItem(lineNumber, email, ex.getMessage()));
                log.warn("[BulkNotification] Linha {}: falha para {} — {}", lineNumber, email, ex.getMessage());
            } catch (Exception ex) {
                failures.add(new BulkFailureItem(lineNumber, email,
                        "Erro interno ao processar o destinatário"));
                log.error("[BulkNotification] Linha {}: erro inesperado para {}", lineNumber, email, ex);
            }
        }

        log.info("[BulkNotification] Concluído: {} sucesso(s), {} falha(s) de {} total",
                successes.size(), failures.size(), records.size());

        return new BulkNotificationResultDTO(
                records.size(),
                successes.size(),
                failures.size(),
                successes,
                failures
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validação
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Valida o arquivo recebido quanto à presença, tamanho e extensão.
     *
     * @param file arquivo multipart enviado pelo cliente
     * @throws AppException se o arquivo for nulo, vazio, muito grande ou de formato inválido
     */
    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw AppException.bulkEmptyFile();
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw AppException.bulkFileTooLarge();
        }

        String filename = file.getOriginalFilename() != null
                ? file.getOriginalFilename().toLowerCase()
                : "";

        if (!filename.endsWith(".csv") && !filename.endsWith(".json")) {
            throw AppException.bulkInvalidFormat();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Parsing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Faz o parsing de um arquivo CSV em uma lista de mapas coluna→valor.
     *
     * <p>A primeira linha é tratada como cabeçalho. Linhas em branco são ignoradas.
     * Valores são trimados automaticamente. O número de colunas por linha é
     * normalizado ao tamanho do cabeçalho — colunas extras são descartadas e
     * colunas faltantes ficam com valor vazio.</p>
     *
     * @param file arquivo CSV com encoding UTF-8
     * @return lista de mapas, um por linha de dados
     * @throws AppException se ocorrer erro de leitura ou o arquivo não tiver cabeçalho
     */
    private List<Map<String, String>> parseCsv(MultipartFile file) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            List<String> lines = reader.lines()
                    .map(String::trim)
                    .filter(line -> !line.isBlank())
                    .toList();

            if (lines.isEmpty()) {
                throw AppException.bulkEmptyFile();
            }

            String[] headers = splitCsvLine(lines.get(0));

            if (headers.length == 0) {
                throw AppException.bulkInvalidFormat();
            }

            List<Map<String, String>> records = new ArrayList<>();

            for (int i = 1; i < lines.size(); i++) {
                String[] values = splitCsvLine(lines.get(i));
                Map<String, String> record = new HashMap<>();

                for (int j = 0; j < headers.length; j++) {
                    String value = (j < values.length) ? values[j].trim() : "";
                    record.put(headers[j].trim().toLowerCase(), value);
                }

                records.add(record);
            }

            return records;

        } catch (AppException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("[BulkNotification] Erro ao fazer parsing do CSV", ex);
            throw AppException.bulkInvalidFormat();
        }
    }

    /**
     * Divide uma linha CSV respeitando aspas duplas ao redor de campos com vírgula.
     *
     * <p>Suporta campos no formato {@code "valor, com virgula"} e remove as aspas
     * externas do valor resultante. Não suporta aspas aninhadas escapadas.</p>
     *
     * @param line linha de texto CSV
     * @return array de valores
     */
    private String[] splitCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }

        result.add(current.toString().trim());
        return result.toArray(new String[0]);
    }

    /**
     * Faz o parsing de um arquivo JSON em uma lista de mapas coluna→valor.
     *
     * <p>Espera um array JSON de objetos planos. Todos os valores são convertidos
     * para {@code String} via {@link Object#toString()} para uniformidade com o
     * fluxo CSV. Valores {@code null} são convertidos para string vazia.</p>
     *
     * @param file arquivo JSON com encoding UTF-8
     * @return lista de mapas, um por objeto do array
     * @throws AppException se o JSON for inválido ou não for um array
     */
    private List<Map<String, String>> parseJson(MultipartFile file) {
        try {
            List<Map<String, Object>> rawList = objectMapper.readValue(
                    file.getInputStream(),
                    new TypeReference<>() {}
            );

            List<Map<String, String>> records = new ArrayList<>();

            for (Map<String, Object> rawRecord : rawList) {
                Map<String, String> record = new HashMap<>();
                rawRecord.forEach((key, value) ->
                        record.put(key.toLowerCase().trim(), value != null ? value.toString() : "")
                );
                records.add(record);
            }

            return records;

        } catch (AppException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("[BulkNotification] Erro ao fazer parsing do JSON", ex);
            throw AppException.bulkInvalidFormat();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Montagem do DTO
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Monta um {@link NotificationRequestDTO} a partir dos dados de uma linha do arquivo.
     *
     * <p>O canal é propagado do parâmetro recebido pelo controller, pois o arquivo
     * de envio em massa não contém (nem deve conter) o canal — esse dado vem do
     * template selecionado pelo usuário na interface.</p>
     *
     * @param templateId        UUID do template
     * @param templateVersionId UUID da versão específica, ou {@code null} para a mais recente
     * @param channel           canal de envio serializado (ex: {@code "EMAIL"})
     * @param email             endereço do destinatário principal
     * @param variables         mapa de variáveis do template para este destinatário
     * @param scheduledAt       data/hora de agendamento, ou {@code null} para envio imediato
     * @return DTO pronto para ser passado ao {@link NotificationService#createNotification}
     */
    private NotificationRequestDTO buildRequest(
            UUID templateId,
            UUID templateVersionId,
            String channel,
            String email,
            Map<String, String> variables,
            OffsetDateTime scheduledAt
    ) {
        NotificationRequestDTO request = new NotificationRequestDTO();
        request.setTemplateId(templateId);
        request.setTemplateVersionId(templateVersionId);
        request.setChannel(com.hermes.entity.NotificationChannel.valueOf(channel));
        request.setRecipients(new RecipientsDTO(List.of(email), List.of(), List.of()));
        request.setVariables(variables != null ? variables : new HashMap<>());
        request.setAttachments(List.of());
        request.setScheduledAt(scheduledAt);
        return request;
    }
}