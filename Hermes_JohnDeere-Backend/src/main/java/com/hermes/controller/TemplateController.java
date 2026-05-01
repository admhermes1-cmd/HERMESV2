package com.hermes.controller;

import com.hermes.dto.template.TemplateRequestDTO;
import com.hermes.dto.template.TemplateResponseDTO;
import com.hermes.dto.template.TemplateVersionRequestDTO;
import com.hermes.dto.template.TemplateVersionResponseDTO;
import com.hermes.dto.PageResponseDTO;
import com.hermes.entity.User;
import com.hermes.entity.enums.TemplateChannel;
import com.hermes.exception.AppException;
import com.hermes.security.JwtUtil;
import com.hermes.service.TemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Controller responsável pelo gerenciamento de templates de notificação do HERMES.
 * <p>
 * Expõe operações CRUD para templates e suas versões. Templates são estruturas
 * reutilizáveis que definem o conteúdo e canal das notificações enviadas pelo sistema.
 * </p>
 *
 * @author HERMES Team
 */
@Slf4j
@RestController
@RequestMapping("/templates")
@RequiredArgsConstructor
@Validated
@Tag(name = "Templates", description = "Gerenciamento de templates de notificação")
public class TemplateController {

    private final TemplateService templateService;
    private final JwtUtil jwtUtil;

    /**
     * Lista templates com suporte a filtro por canal e paginação.
     *
     * @param channel filtro opcional pelo canal de comunicação (ex.: EMAIL, SMS, WHATSAPP)
     * @param page    número da página, 1-based (padrão: 1)
     * @param limit   quantidade de itens por página (padrão: 10)
     * @return página de {@link TemplateResponseDTO} com metadados de paginação
     */
    @GetMapping
    @Operation(
            summary = "Listar templates",
            description = "Retorna uma lista paginada de templates, com filtro opcional por canal."
    )
    @ApiResponse(responseCode = "200", description = "Lista de templates retornada com sucesso")
    public ResponseEntity<PageResponseDTO<TemplateResponseDTO>> listTemplates(
            @Parameter(description = "Canal de comunicação: EMAIL, SMS, WHATSAPP, etc.")
            @RequestParam(required = false) String channel,
            @Parameter(description = "Número da página (1-based)")
            @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Quantidade de itens por página")
            @RequestParam(defaultValue = "10") int limit) {

        TemplateChannel templateChannel = (channel != null)
                ? TemplateChannel.valueOf(channel.toUpperCase())
                : null;

        PageResponseDTO<TemplateResponseDTO> result = templateService.listTemplates(templateChannel, page, limit);
        return ResponseEntity.ok(result);
    }

    /**
     * Busca um template específico pelo seu identificador único.
     *
     * @param id UUID do template
     * @return {@link TemplateResponseDTO} com os dados completos do template
     */
    @GetMapping("/{id}")
    @Operation(
            summary = "Buscar template por ID",
            description = "Retorna os dados completos de um template específico."
    )
    @ApiResponse(responseCode = "200", description = "Template encontrado")
    @ApiResponse(responseCode = "404", description = "Template não encontrado")
    public ResponseEntity<TemplateResponseDTO> getTemplate(
            @Parameter(description = "UUID do template") @PathVariable UUID id) {

        TemplateResponseDTO template = templateService.getTemplate(id);
        return ResponseEntity.ok(template);
    }

    /**
     * Cria um novo template de notificação.
     * <p>
     * O UUID do criador é extraído automaticamente do token JWT da requisição,
     * evitando uma consulta adicional ao banco de dados.
     * </p>
     *
     * @param request dados do template a ser criado
     * @return {@link TemplateResponseDTO} do template criado, com status 201
     */
    @PostMapping
    @Operation(
            summary = "Criar template",
            description = "Cria um novo template de notificação vinculado ao usuário autenticado."
    )
    @ApiResponse(responseCode = "201", description = "Template criado com sucesso")
    @ApiResponse(responseCode = "409", description = "Já existe um template com o mesmo nome")
    @ApiResponse(responseCode = "400", description = "Dados inválidos")
    public ResponseEntity<TemplateResponseDTO> createTemplate(
            @RequestBody @Valid TemplateRequestDTO request) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID createdBy = getAuthenticatedUserId(auth);

        log.info("Criando template '{}' pelo usuário: {}", request.getName(), createdBy);

        TemplateResponseDTO created = templateService.createTemplate(request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Atualiza um template existente pelo seu ID.
     *
     * @param id      UUID do template a ser atualizado
     * @param request novos dados do template
     * @return {@link TemplateResponseDTO} com os dados atualizados
     */
    @PutMapping("/{id}")
    @Operation(
            summary = "Atualizar template",
            description = "Atualiza os dados de um template existente."
    )
    @ApiResponse(responseCode = "200", description = "Template atualizado com sucesso")
    @ApiResponse(responseCode = "404", description = "Template não encontrado")
    @ApiResponse(responseCode = "400", description = "Dados inválidos")
    public ResponseEntity<TemplateResponseDTO> updateTemplate(
            @Parameter(description = "UUID do template") @PathVariable UUID id,
            @RequestBody @Valid TemplateRequestDTO request) {

        log.info("Atualizando template: {}", id);

        TemplateResponseDTO updated = templateService.updateTemplate(id, request);
        return ResponseEntity.ok(updated);
    }

    /**
     * Remove um template pelo seu ID.
     * <p>
     * A operação falha com 409 se o template possuir notificações vinculadas,
     * garantindo integridade referencial.
     * </p>
     *
     * @param id UUID do template a ser removido
     * @return 204 No Content em caso de sucesso
     */
    @DeleteMapping("/{id}")
    @Operation(
            summary = "Deletar template",
            description = "Remove um template. Falha se houver notificações vinculadas ao template."
    )
    @ApiResponse(responseCode = "204", description = "Template deletado com sucesso")
    @ApiResponse(responseCode = "404", description = "Template não encontrado")
    @ApiResponse(responseCode = "409", description = "Template possui notificações vinculadas e não pode ser removido")
    public ResponseEntity<Void> deleteTemplate(
            @Parameter(description = "UUID do template") @PathVariable UUID id) {

        log.info("Deletando template: {}", id);

        templateService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Lista todas as versões de um template específico.
     *
     * @param id UUID do template pai
     * @return lista de {@link TemplateVersionResponseDTO} ordenada por versão
     */
    @GetMapping("/{id}/versions")
    @Operation(
            summary = "Listar versões do template",
            description = "Retorna todas as versões cadastradas para um template específico."
    )
    @ApiResponse(responseCode = "200", description = "Versões retornadas com sucesso")
    @ApiResponse(responseCode = "404", description = "Template não encontrado")
    public ResponseEntity<List<TemplateVersionResponseDTO>> listVersions(
            @Parameter(description = "UUID do template") @PathVariable UUID id) {

        List<TemplateVersionResponseDTO> versions = templateService.listVersions(id);
        return ResponseEntity.ok(versions);
    }

    /**
     * Cria uma nova versão para um template existente.
     *
     * @param id      UUID do template pai
     * @param request dados da nova versão
     * @return {@link TemplateVersionResponseDTO} da versão criada, com status 201
     */
    @PostMapping("/{id}/versions")
    @Operation(
            summary = "Criar nova versão do template",
            description = "Adiciona uma nova versão a um template existente, permitindo versionamento de conteúdo."
    )
    @ApiResponse(responseCode = "201", description = "Versão criada com sucesso")
    @ApiResponse(responseCode = "404", description = "Template não encontrado")
    @ApiResponse(responseCode = "400", description = "Dados inválidos")
    public ResponseEntity<TemplateVersionResponseDTO> createVersion(
            @Parameter(description = "UUID do template") @PathVariable UUID id,
            @RequestBody @Valid TemplateVersionRequestDTO request) {

        log.info("Criando nova versão para o template: {}", id);

        TemplateVersionResponseDTO created = templateService.createVersion(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Atualiza uma versão específica de um template.
     *
     * @param id        UUID do template pai
     * @param versionId UUID da versão a ser atualizada
     * @param request   novos dados da versão
     * @return {@link TemplateVersionResponseDTO} com os dados atualizados
     */
    @PutMapping("/{id}/versions/{versionId}")
    @Operation(
            summary = "Atualizar versão do template",
            description = "Atualiza o conteúdo de uma versão específica de um template."
    )
    @ApiResponse(responseCode = "200", description = "Versão atualizada com sucesso")
    @ApiResponse(responseCode = "404", description = "Template ou versão não encontrados")
    @ApiResponse(responseCode = "400", description = "Dados inválidos")
    public ResponseEntity<TemplateVersionResponseDTO> updateVersion(
            @Parameter(description = "UUID do template") @PathVariable UUID id,
            @Parameter(description = "UUID da versão") @PathVariable UUID versionId,
            @RequestBody @Valid TemplateVersionRequestDTO request) {

        log.info("Atualizando versão {} do template: {}", versionId, id);

        TemplateVersionResponseDTO updated = templateService.updateVersion(id, versionId, request);
        return ResponseEntity.ok(updated);
    }

    // -------------------------------------------------------------------------
    // Helpers privados
    // -------------------------------------------------------------------------

    /**
     * Extrai o token JWT bruto (sem o prefixo "Bearer ") das credenciais do
     * objeto {@link Authentication}, para uso com {@link JwtUtil}.
     *
     * @param auth objeto de autenticação do SecurityContext
     * @return string do token JWT
     */
    private UUID getAuthenticatedUserId(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw AppException.unauthorized(AppException.ErrorCode.AUTH_INVALID_CREDENTIALS,
                    "Usuário não autenticado");
        }

        if (auth.getPrincipal() instanceof User user) {
            return user.getId();
        }

        if (auth.getCredentials() != null) {
            return jwtUtil.extractUserId(auth.getCredentials().toString());
        }

        throw AppException.unauthorized(AppException.ErrorCode.AUTH_INVALID_CREDENTIALS,
                "Não foi possível extrair o usuário autenticado.");
    }
}
