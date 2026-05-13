package com.hermes.controller;

import com.hermes.dto.notification.BulkImportResultDTO;
import com.hermes.service.BulkImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Controller REST que expõe o endpoint de importação em massa de usuários.
 *
 * <p><b>Rota:</b> {@code POST /api/v1/users/bulk-import}</p>
 * <p><b>Acesso:</b> Somente usuários com role {@code ADMIN}</p>
 * <p><b>Content-Type:</b> {@code multipart/form-data}</p>
 *
 * <p>Aceita arquivos {@code .csv} ou {@code .json} e delega toda a lógica
 * de parsing, validação, criação e e-mail ao {@link BulkImportService}.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Importação em Massa", description = "Criação de múltiplos usuários via CSV ou JSON")
@SecurityRequirement(name = "bearerAuth")
public class BulkImportController {

    /** Tamanho máximo permitido para o arquivo de importação (5 MB). */
    private static final long MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

    private final BulkImportService bulkImportService;

    /**
     * Importa usuários em massa a partir de um arquivo CSV ou JSON.
     *
     * <p>O endpoint aplica a estratégia <em>partial-commit</em>: linhas válidas
     * são criadas independentemente das inválidas. O resultado retorna o detalhamento
     * completo de sucessos e falhas para que o cliente possa exibir um relatório.</p>
     *
     * @param file Arquivo multipart (.csv ou .json) com os dados dos usuários
     * @return {@link BulkImportResultDTO} com totais e listas detalhadas
     */
    @PostMapping(value = "/bulk-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary     = "Importar usuários em massa",
            description = "Processa um arquivo CSV ou JSON e cria múltiplos usuários. "
                        + "E-mails de boas-vindas são enviados automaticamente. "
                        + "Erros em linhas individuais não interrompem a importação das demais."
    )
    @ApiResponse(
            responseCode = "200",
            description  = "Importação concluída (com ou sem falhas parciais)",
            content      = @Content(schema = @Schema(implementation = BulkImportResultDTO.class))
    )
    @ApiResponse(responseCode = "400", description = "Arquivo inválido ou tipo não suportado")
    @ApiResponse(responseCode = "403", description = "Acesso negado — requer role ADMIN")
    @ApiResponse(responseCode = "413", description = "Arquivo excede o tamanho máximo de 5 MB")
    public ResponseEntity<BulkImportResultDTO> bulkImport(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            return ResponseEntity.status(413).build();
        }

        log.info("Importação em massa iniciada — arquivo: {}, tamanho: {} bytes",
                file.getOriginalFilename(), file.getSize());

        BulkImportResultDTO result = bulkImportService.importUsers(file);

        log.info("Importação em massa concluída — sucesso: {}, falhas: {}",
                result.successCount(), result.failureCount());

        return ResponseEntity.ok(result);
    }
}