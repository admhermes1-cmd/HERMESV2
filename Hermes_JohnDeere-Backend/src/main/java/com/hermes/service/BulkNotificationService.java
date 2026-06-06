package com.hermes.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.dto.notification.BulkNotificationResultDTO;
import com.hermes.dto.notification.BulkNotificationResultDTO.BulkFailureItem;
import com.hermes.dto.notification.BulkNotificationResultDTO.BulkSuccessItem;
import com.hermes.dto.notification.NotificationRequestDTO;
import com.hermes.dto.notification.NotificationRequestDTO.RecipientsDTO;
import com.hermes.entity.enums.NotificationChannel;
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
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkNotificationService {

    private static final int    MAX_RECORDS        = 200;
    private static final long   MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final String EMAIL_COLUMN        = "email";
    private static final String NAME_COLUMN         = "nome";

    private final NotificationService notificationService;
    private final ObjectMapper        objectMapper;

    /**
     * Processa um arquivo CSV ou JSON de destinatários e executa o envio em massa.
     *
     * @param templateId        identificador do template a ser utilizado em todos os envios
     * @param templateVersionId identificador da versão específica do template
     * @param channel           canal de envio (ex: {@code EMAIL})
     * @param scheduledAt       data/hora de agendamento, ou {@code null} para envio imediato
     * @param file              arquivo CSV ou JSON com os destinatários e variáveis do template
     * @param createdBy         UUID do usuário autenticado que disparou a operação
     * @return {@link BulkNotificationResultDTO} com totais e detalhes de sucesso/falha
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
            int lineNumber          = i + 1;
            Map<String, String> record = records.get(i);
            String email            = record.get(EMAIL_COLUMN);

            if (email == null || email.isBlank()) {
                failures.add(new BulkFailureItem(lineNumber, null, "Coluna 'email' ausente ou vazia"));
                log.warn("[BulkNotification] Linha {}: email ausente", lineNumber);
                continue;
            }

            email = email.trim();

            try {
                Map<String, String> variables = new HashMap<>(record);
                variables.remove(EMAIL_COLUMN);

                NotificationRequestDTO request = buildRequest(
                        templateId, templateVersionId, channel,
                        email, variables, scheduledAt
                );

                notificationService.createNotification(request, List.of(), createdBy);

                String name = record.getOrDefault(NAME_COLUMN, null);
                successes.add(new BulkSuccessItem(lineNumber, email, name));

                log.debug("[BulkNotification] Linha {}: enviado com sucesso para {}", lineNumber, email);

            } catch (AppException ex) {
                failures.add(new BulkFailureItem(lineNumber, email, ex.getMessage()));
                log.warn("[BulkNotification] Linha {}: falha para {} — {}", lineNumber, email, ex.getMessage());
            } catch (Exception ex) {
                failures.add(new BulkFailureItem(lineNumber, email, "Erro interno ao processar o destinatário"));
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

    // ─── Validação ───────────────────────────────────────────────────────────

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

    // ─── Parsing ─────────────────────────────────────────────────────────────

    private List<Map<String, String>> parseCsv(MultipartFile file) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            List<String> lines = reader.lines()
                    .map(String::trim)
                    .filter(line -> !line.isBlank())
                    .toList();

            if (lines.isEmpty()) throw AppException.bulkEmptyFile();

            String[] headers = splitCsvLine(lines.get(0));
            if (headers.length == 0) throw AppException.bulkInvalidFormat();

            List<Map<String, String>> records = new ArrayList<>();

            for (int i = 1; i < lines.size(); i++) {
                String[] values = splitCsvLine(lines.get(i));
                Map<String, String> record = new HashMap<>();
                for (int j = 0; j < headers.length; j++) {
                    record.put(headers[j].trim().toLowerCase(), (j < values.length) ? values[j].trim() : "");
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
                        record.put(key.toLowerCase().trim(), value != null ? value.toString() : ""));
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

    // ─── Montagem do DTO ─────────────────────────────────────────────────────

    /**
     * Monta um {@link NotificationRequestDTO} a partir dos dados de uma linha do arquivo.
     *
     * <p>O canal é resolvido via {@link NotificationChannel#valueOf(String)} usando o
     * import correto de {@code com.hermes.entity.enums.NotificationChannel}.</p>
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
        request.setChannel(NotificationChannel.valueOf(channel));
        request.setRecipients(new RecipientsDTO(List.of(email), List.of(), List.of()));
        request.setVariables(variables != null ? variables : new HashMap<>());
        request.setAttachments(List.of());
        request.setScheduledAt(scheduledAt);
        return request;
    }
}