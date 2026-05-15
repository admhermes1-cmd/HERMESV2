package com.hermes.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.dto.notification.BulkImportResultDTO;
import com.hermes.dto.notification.BulkImportResultDTO.RowFailure;
import com.hermes.dto.notification.UserImportRowDTO;
import com.hermes.dto.user.UserRequestDTO;
import com.hermes.dto.user.UserResponseDTO;
import com.hermes.entity.enums.UserRole;
import com.hermes.repository.UserRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Service responsável por processar a importação em massa de usuários a partir
 * de arquivos CSV ou JSON.
 *
 * <p><b>Fluxo por linha/objeto:</b></p>
 * <ol>
 *   <li>Deserialização e mapeamento para {@link UserImportRowDTO}</li>
 *   <li>Validação via Bean Validation</li>
 *   <li>Verificação de unicidade de e-mail no banco</li>
 *   <li>Delegação ao {@link UserService#createUser(UserRequestDTO)}, que já encapsula
 *       a persistência, geração de senha e envio do e-mail de boas-vindas</li>
 * </ol>
 *
 * <p>Erros em linhas individuais são coletados sem abortar o restante da importação
 * (estratégia partial-commit). O resultado consolidado é retornado ao controlador.</p>
 *
 * <p><b>Roles aceitas:</b> {@code ADMIN} e {@code USER} — conforme {@link UserRole}.</p>
 *
 * <p><b>Nota sobre senha:</b> a coluna {@code password} do arquivo é ignorada intencionalmente.
 * O {@link UserService} sempre gera a senha internamente e a envia por e-mail, garantindo
 * que o fluxo de boas-vindas seja idêntico ao da criação manual de usuários.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkImportService {

    private static final String CSV_DELIMITER = ",";

    private final UserRepository userRepository;
    private final UserService    userService;
    private final Validator      validator;
    private final ObjectMapper   objectMapper;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Processa um arquivo multipart de importação em massa.
     *
     * @param file Arquivo CSV ou JSON enviado pelo cliente
     * @return {@link BulkImportResultDTO} com o resumo completo da operação
     * @throws IllegalArgumentException se o tipo de arquivo não for suportado ou inválido
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
            throw new IllegalArgumentException("Falha ao processar o arquivo: " + e.getMessage());
        }

        return processRows(rows);
    }

    // -------------------------------------------------------------------------
    // Parsing
    // -------------------------------------------------------------------------

    /**
     * Faz o parse de um arquivo CSV com cabeçalho obrigatório.
     *
     * <p>Formato esperado (case-insensitive):</p>
     * <pre>name,email,role,password</pre>
     * <p>A coluna {@code password} é aceita no arquivo mas ignorada no processamento —
     * o {@link UserService} sempre gera a senha internamente.</p>
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
            int nameIdx      = findRequiredColumn(headers, "name");
            int emailIdx     = findRequiredColumn(headers, "email");
            int roleIdx      = findRequiredColumn(headers, "role");
            // password é opcional e ignorado no processamento, mas aceito no arquivo
            int passwordIdx  = findOptionalColumn(headers, "password");

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;

                String[] cols   = line.split(CSV_DELIMITER, -1);
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
     *
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
     * Itera as linhas deserializadas, valida e delega a criação ao {@link UserService}.
     * Erros individuais são coletados; a operação continua para as demais linhas.
     */
    private BulkImportResultDTO processRows(List<UserImportRowDTO> rows) {
        List<String>     successfulUsers = new ArrayList<>();
        List<RowFailure> failures        = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            int rowNumber        = i + 1; // 1-based para o relatório
            UserImportRowDTO dto = rows.get(i);

            try {
                // 1. Bean Validation
                Set<ConstraintViolation<UserImportRowDTO>> violations = validator.validate(dto);
                if (!violations.isEmpty()) {
                    String reason = violations.stream()
                            .map(ConstraintViolation::getMessage)
                            .reduce((a, b) -> a + "; " + b)
                            .orElse("Dados inválidos");
                    failures.add(new RowFailure(rowNumber, dto.email(), reason));
                    continue;
                }

                // 2. Role válida — apenas ADMIN e USER existem em UserRole
                UserRole role;
                try {
                    role = UserRole.valueOf(dto.role().toUpperCase());
                } catch (IllegalArgumentException e) {
                    failures.add(new RowFailure(rowNumber, dto.email(),
                            "Role inválida: '" + dto.role() + "'. Valores aceitos: ADMIN, USER"));
                    continue;
                }

                // 3. Unicidade de e-mail (verificação antecipada para erro descritivo)
                if (userRepository.existsByEmail(dto.email().toLowerCase())) {
                    failures.add(new RowFailure(rowNumber, dto.email(),
                            "E-mail já cadastrado no sistema"));
                    continue;
                }

                // 4. Delega ao UserService — ele gera a senha, persiste e envia o e-mail
                UserRequestDTO userRequest = new UserRequestDTO(
                        dto.name().trim(),
                        dto.email().trim().toLowerCase(),
                        role,
                        true  // isActive = true por padrão na importação
                );

                UserResponseDTO created = userService.createUser(userRequest);

                successfulUsers.add(created.email());
                log.info("Importação em massa: usuário criado — {}", created.email());

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
            // remove BOM (U+FEFF) presente em arquivos exportados pelo Excel
            normalized[i] = headers[i].trim().toLowerCase().replace("\uFEFF", "");
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
}