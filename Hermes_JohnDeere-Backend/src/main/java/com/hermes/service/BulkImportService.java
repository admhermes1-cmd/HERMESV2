package com.hermes.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.dto.notification.BulkImportResultDTO;
import com.hermes.dto.notification.BulkImportResultDTO.RowFailure;
import com.hermes.dto.notification.UserImportRowDTO;
import com.hermes.entity.enums.userRole;
import com.hermes.entity.User;
import com.hermes.repository.UserRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;

/**
 * Service responsável por processar a importação em massa de usuários a partir
 * de arquivos CSV ou JSON.
 *
 * <p><b>Fluxo por linha/objeto:</b></p>
 * <ol>
 *   <li>Deserialização e mapeamento para {@link UserImportRowDTO}</li>
 *   <li>Validação via Bean Validation (jakarta.validation)</li>
 *   <li>Verificação de unicidade de e-mail no banco</li>
 *   <li>Criação e persistência do {@link User} (reutiliza {@link UserService#createUser})</li>
 *   <li>Disparo do e-mail de boas-vindas (reutiliza {@link NotificationService})</li>
 * </ol>
 *
 * <p>Erros em linhas individuais são coletados sem abortar o restante da importação
 * (estratégia partial-commit). O resultado consolidado é retornado ao controlador.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkImportService {

    private static final String CSV_DELIMITER = ",";
    private static final int PASSWORD_BYTE_LENGTH = 16;

    private final UserRepository userRepository;
    private final UserService userService;
    private final NotificationService notificationService;
    private final PasswordEncoder passwordEncoder;
    private final Validator validator;
    private final ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Processa um arquivo multipart de importação em massa.
     *
     * @param file Arquivo CSV ou JSON enviado pelo cliente
     * @return {@link BulkImportResultDTO} com o resumo completo da operação
     * @throws IllegalArgumentException se o tipo de arquivo não for suportado
     */
    public BulkImportResultDTO importUsers(MultipartFile file) {
        String filename = file.getOriginalFilename() != null
                ? file.getOriginalFilename().toLowerCase()
                : "";

        List<UserImportRowDTO> rows;

        try {
            if (filename.endsWith(".csv")) {
                rows = parseCsv(file);
            } else if (filename.endsWith(".json")) {
                rows = parseJson(file);
            } else {
                throw new IllegalArgumentException(
                        "Tipo de arquivo não suportado. Envie um arquivo .csv ou .json");
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erro ao fazer o parse do arquivo de importação: {}", e.getMessage(), e);
            throw new IllegalArgumentException(
                    "Falha ao processar o arquivo: " + e.getMessage());
        }

        return processRows(rows);
    }

    // -------------------------------------------------------------------------
    // Parsing
    // -------------------------------------------------------------------------

    /**
     * Faz o parse de um arquivo CSV com cabeçalho obrigatório.
     * <p>Formato esperado (case-insensitive):</p>
     * <pre>name,email,role,password</pre>
     * <p>A coluna {@code password} é opcional; linhas sem ela terão senha gerada.</p>
     */
    private List<UserImportRowDTO> parseCsv(MultipartFile file) throws Exception {
        List<UserImportRowDTO> rows = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new IllegalArgumentException("O arquivo CSV está vazio");
            }

            String[] headers = normalizeCsvHeaders(headerLine.split(CSV_DELIMITER));
            int nameIdx    = findRequiredColumn(headers, "name");
            int emailIdx   = findRequiredColumn(headers, "email");
            int roleIdx    = findRequiredColumn(headers, "role");
            int passwordIdx = findOptionalColumn(headers, "password");

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;

                String[] cols = line.split(CSV_DELIMITER, -1);
                String password = (passwordIdx >= 0 && passwordIdx < cols.length)
                        ? cols[passwordIdx].trim()
                        : null;

                rows.add(new UserImportRowDTO(
                        safeGet(cols, nameIdx),
                        safeGet(cols, emailIdx),
                        safeGet(cols, roleIdx),
                        (password == null || password.isBlank()) ? null : password
                ));
            }
        }

        return rows;
    }

    /**
     * Faz o parse de um arquivo JSON contendo um array de objetos de usuário.
     * <p>Formato esperado:</p>
     * <pre>[{"name":"...","email":"...","role":"...","password":"..."}]</pre>
     */
    private List<UserImportRowDTO> parseJson(MultipartFile file) throws Exception {
        return objectMapper.readValue(
                file.getInputStream(),
                new TypeReference<List<UserImportRowDTO>>() {}
        );
    }

    // -------------------------------------------------------------------------
    // Processing
    // -------------------------------------------------------------------------

    /**
     * Itera as linhas deserializadas, valida, persiste e dispara e-mails.
     * Erros individuais são coletados; a operação continua para as demais linhas.
     */
    private BulkImportResultDTO processRows(List<UserImportRowDTO> rows) {
        List<String> successfulUsers = new ArrayList<>();
        List<RowFailure> failures     = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            int rowNumber = i + 1; // 1-based para o relatório
            UserImportRowDTO dto = rows.get(i);

            try {
                // 1. Validação de Bean Validation
                Set<ConstraintViolation<UserImportRowDTO>> violations = validator.validate(dto);
                if (!violations.isEmpty()) {
                    String reason = violations.stream()
                            .map(ConstraintViolation::getMessage)
                            .reduce((a, b) -> a + "; " + b)
                            .orElse("Dados inválidos");
                    failures.add(new RowFailure(rowNumber, dto.email(), reason));
                    continue;
                }

                // 2. Role válida
                Role role;
                try {
                    role = Role.valueOf(dto.role().toUpperCase());
                } catch (IllegalArgumentException e) {
                    failures.add(new RowFailure(rowNumber, dto.email(),
                            "Role inválida: '" + dto.role() + "'. Use ADMIN, MANAGER ou USER"));
                    continue;
                }

                // 3. Unicidade de e-mail
                if (userRepository.existsByEmail(dto.email().toLowerCase())) {
                    failures.add(new RowFailure(rowNumber, dto.email(),
                            "E-mail já cadastrado no sistema"));
                    continue;
                }

                // 4. Senha — usa a fornecida ou gera uma aleatória segura
                String rawPassword = (dto.password() != null && !dto.password().isBlank())
                        ? dto.password()
                        : generateSecurePassword();

                // 5. Criação do usuário (reutiliza UserService)
                User created = userService.createUser(
                        dto.name().trim(),
                        dto.email().trim().toLowerCase(),
                        rawPassword,
                        role
                );

                // 6. E-mail de boas-vindas (reutiliza NotificationService)
                notificationService.sendWelcomeEmail(created, rawPassword);

                successfulUsers.add(created.getEmail());
                log.info("Importação em massa: usuário criado — {}", created.getEmail());

            } catch (Exception e) {
                log.error("Importação em massa: falha na linha {} ({}): {}",
                        rowNumber, dto.email(), e.getMessage(), e);
                failures.add(new RowFailure(rowNumber, dto.email(),
                        "Erro interno ao criar usuário: " + e.getMessage()));
            }
        }

        return new BulkImportResultDTO(
                rows.size(),
                successfulUsers.size(),
                failures.size(),
                successfulUsers,
                failures
        );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String[] normalizeCsvHeaders(String[] headers) {
        String[] normalized = new String[headers.length];
        for (int i = 0; i < headers.length; i++) {
            normalized[i] = headers[i].trim().toLowerCase()
                    .replace("\uFEFF", ""); // remove BOM se presente
        }
        return normalized;
    }

    private int findRequiredColumn(String[] headers, String name) {
        for (int i = 0; i < headers.length; i++) {
            if (headers[i].equals(name)) return i;
        }
        throw new IllegalArgumentException(
                "Coluna obrigatória ausente no CSV: '" + name + "'");
    }

    private int findOptionalColumn(String[] headers, String name) {
        for (int i = 0; i < headers.length; i++) {
            if (headers[i].equals(name)) return i;
        }
        return -1;
    }

    private String safeGet(String[] cols, int index) {
        if (index < 0 || index >= cols.length) return "";
        return cols[index].trim();
    }

    private String generateSecurePassword() {
        byte[] bytes = new byte[PASSWORD_BYTE_LENGTH];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}