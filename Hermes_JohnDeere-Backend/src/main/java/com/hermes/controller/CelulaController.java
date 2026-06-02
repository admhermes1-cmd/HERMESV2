package com.hermes.controller;

import com.hermes.dto.celula.CelulaDetalheDTO;
import com.hermes.dto.celula.CelulaRequestDTO;
import com.hermes.dto.celula.CelulaResponseDTO;
import com.hermes.dto.user.UserListResponseDTO;
import com.hermes.dto.PageResponseDTO;
import com.hermes.service.CelulaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Controller REST para gerenciamento de células organizacionais.
 *
 * <p>Regras de acesso por endpoint:</p>
 * <ul>
 *   <li>{@code GET /celulas}              — ADMIN e GESTOR</li>
 *   <li>{@code GET /celulas/{id}}         — ADMIN e GESTOR</li>
 *   <li>{@code GET /celulas/{id}/usuarios}— ADMIN e GESTOR</li>
 *   <li>{@code POST /celulas}             — apenas ADMIN</li>
 *   <li>{@code PUT /celulas/{id}}         — ADMIN e GESTOR</li>
 *   <li>{@code DELETE /celulas/{id}}      — apenas ADMIN</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/celulas")
@RequiredArgsConstructor
public class CelulaController {

    private final CelulaService celulaService;

    // =========================================================================
    // GET /celulas — listagem paginada
    // =========================================================================

    /**
     * Lista todas as células com paginação.
     *
     * @param page  número da página (1-based, padrão 1).
     * @param limit itens por página (padrão 20).
     * @return página de {@link CelulaResponseDTO}.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'GESTOR')")
    public ResponseEntity<PageResponseDTO<CelulaResponseDTO>> listCelulas(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {

        log.debug("GET /celulas — page={}, limit={}", page, limit);
        return ResponseEntity.ok(celulaService.listCelulas(page, limit));
    }

    // =========================================================================
    // GET /celulas/{id} — detalhe completo
    // =========================================================================

    /**
     * Retorna os detalhes completos de uma célula, incluindo a lista de usuários.
     *
     * @param id UUID da célula.
     * @return {@link CelulaDetalheDTO} com todos os dados e usuários vinculados.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GESTOR')")
    public ResponseEntity<CelulaDetalheDTO> findById(@PathVariable UUID id) {
        log.debug("GET /celulas/{}", id);
        return ResponseEntity.ok(celulaService.findById(id));
    }

    // =========================================================================
    // GET /celulas/{id}/usuarios — usuários da célula
    // =========================================================================

    /**
     * Lista os usuários vinculados a uma célula específica.
     *
     * @param id UUID da célula.
     * @return lista de {@link UserListResponseDTO}.
     */
    @GetMapping("/{id}/usuarios")
    @PreAuthorize("hasAnyRole('ADMIN', 'GESTOR')")
    public ResponseEntity<List<UserListResponseDTO>> listUsuarios(@PathVariable UUID id) {
        log.debug("GET /celulas/{}/usuarios", id);
        return ResponseEntity.ok(celulaService.listUsuariosByCelula(id));
    }

    // =========================================================================
    // POST /celulas — criação
    // =========================================================================

    /**
     * Cria uma nova célula.
     *
     * @param dto dados da nova célula.
     * @return {@link CelulaResponseDTO} da célula criada com status 201.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CelulaResponseDTO> createCelula(@Valid @RequestBody CelulaRequestDTO dto) {
        log.debug("POST /celulas — nome={}", dto.nome());
        CelulaResponseDTO response = celulaService.createCelula(dto);
        return ResponseEntity.status(201).body(response);
    }

    // =========================================================================
    // PUT /celulas/{id} — edição
    // =========================================================================

    /**
     * Atualiza os dados de uma célula existente.
     *
     * @param id  UUID da célula.
     * @param dto dados atualizados.
     * @return {@link CelulaResponseDTO} atualizado.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GESTOR')")
    public ResponseEntity<CelulaResponseDTO> updateCelula(
            @PathVariable UUID id,
            @Valid @RequestBody CelulaRequestDTO dto) {

        log.debug("PUT /celulas/{}", id);
        return ResponseEntity.ok(celulaService.updateCelula(id, dto));
    }

    // =========================================================================
    // DELETE /celulas/{id} — exclusão
    // =========================================================================

    /**
     * Remove uma célula do sistema.
     * Os usuários vinculados ficam sem célula (campo zerado).
     *
     * @param id UUID da célula.
     * @return 204 No Content.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCelula(@PathVariable UUID id) {
        log.debug("DELETE /celulas/{}", id);
        celulaService.deleteCelula(id);
        return ResponseEntity.noContent().build();
    }
}