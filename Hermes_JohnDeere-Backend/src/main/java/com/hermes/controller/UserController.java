package com.hermes.controller;

import com.hermes.dto.PageResponseDTO;
import com.hermes.dto.user.UserListResponseDTO;
import com.hermes.dto.user.UserRequestDTO;
import com.hermes.dto.user.UserResponseDTO;
import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import com.hermes.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Controller REST para gerenciamento de usuários.
 *
 * <p>Endpoints acessíveis por ADMIN e GESTOR. A validação de quais usuários
 * cada role pode operar (ex: GESTOR não pode editar ADMIN/GESTOR) é feita
 * no {@link UserService#validateRoleTarget}, não aqui.</p>
 *
 * <p>Base path: {@code /users}</p>
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'GESTOR')")
@Tag(name = "Usuários", description = "Gerenciamento de usuários — ADMIN e GESTOR")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    // -------------------------------------------------------------------------
    // GET /users
    // -------------------------------------------------------------------------

    /**
     * Lista usuários de forma paginada com filtros opcionais.
     *
     * @param page     índice da página (1-based).
     * @param limit    itens por página (padrão 10).
     * @param role     filtra por papel (opcional).
     * @param isActive filtra por situação da conta (opcional).
     * @return página de {@link UserListResponseDTO}.
     */
    @GetMapping
    @Operation(summary = "Listar usuários", description = "Retorna lista paginada com filtros opcionais por role e isActive")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listagem retornada com sucesso"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<PageResponseDTO<UserListResponseDTO>> listUsers(
            @Parameter(description = "Índice da página (1-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Itens por página") @RequestParam(defaultValue = "10") int limit,
            @Parameter(description = "Filtro por papel") @RequestParam(required = false) UserRole role,
            @Parameter(description = "Filtro por situação da conta") @RequestParam(required = false) Boolean isActive
    ) {
        Page<UserListResponseDTO> result = userService.listUsers(Math.max(0, page - 1), limit, role, isActive);
        return ResponseEntity.ok(PageResponseDTO.from(result, page, limit));
    }

    // -------------------------------------------------------------------------
    // GET /users/{id}
    // -------------------------------------------------------------------------

    /**
     * Retorna os dados completos de um usuário, incluindo {@code apiKey}.
     *
     * @param id identificador UUID do usuário.
     * @return {@link UserResponseDTO} com todos os campos públicos.
     */
    @GetMapping("/{id}")
    @Operation(summary = "Buscar usuário por ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Usuário encontrado"),
            @ApiResponse(responseCode = "404", description = "Usuário não encontrado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<UserResponseDTO> findById(
            @Parameter(description = "UUID do usuário") @PathVariable UUID id
    ) {
        return ResponseEntity.ok(userService.findById(id));
    }

    // -------------------------------------------------------------------------
    // POST /users
    // -------------------------------------------------------------------------

    /**
     * Cria um novo usuário.
     *
     * <p>A senha e a matrícula são geradas automaticamente pelo backend.
     * O {@link UserService} valida se o requester tem permissão para criar
     * um usuário com o role informado no DTO.</p>
     *
     * @param dto       dados do novo usuário.
     * @param requester usuário autenticado extraído do token JWT.
     * @return {@link UserResponseDTO} com status {@code 201 Created}.
     */
    @PostMapping
    @Operation(summary = "Criar usuário", description = "Gera senha e matrícula automáticas e envia por e-mail")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Usuário criado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "409", description = "E-mail já cadastrado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<UserResponseDTO> createUser(
            @Valid @RequestBody UserRequestDTO dto,
            @AuthenticationPrincipal User requester
    ) {
        UserResponseDTO response = userService.createUser(dto, requester);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // -------------------------------------------------------------------------
    // PUT /users/{id}
    // -------------------------------------------------------------------------

    /**
     * Atualiza os dados de um usuário existente.
     *
     * <p>O campo {@code email} é ignorado — o e-mail é imutável após a criação.
     * A matrícula também é imutável.</p>
     *
     * @param id        identificador UUID do usuário.
     * @param dto       dados a atualizar.
     * @param requester usuário autenticado extraído do token JWT.
     * @return {@link UserResponseDTO} atualizado.
     */
    @PutMapping("/{id}")
    @Operation(summary = "Atualizar usuário", description = "Edita name, role, cargo, celula e isActive. E-mail e matrícula são imutáveis.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Usuário atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "404", description = "Usuário não encontrado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserRequestDTO dto,
            @AuthenticationPrincipal User requester
    ) {
        return ResponseEntity.ok(userService.updateUser(id, dto, requester));
    }

    // -------------------------------------------------------------------------
    // POST /users/{id}/reset-password
    // -------------------------------------------------------------------------

    /**
     * Redefine a senha do usuário, gerando uma nova senha aleatória e enviando por e-mail.
     *
     * @param id identificador UUID do usuário.
     * @return {@code 204 No Content} em caso de sucesso.
     */
    @PostMapping("/{id}/reset-password")
    @Operation(summary = "Redefinir senha", description = "Gera nova senha aleatória e envia por e-mail ao usuário")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Senha redefinida com sucesso"),
            @ApiResponse(responseCode = "404", description = "Usuário não encontrado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<Void> resetPassword(@PathVariable UUID id) {
        userService.resetPassword(id);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // DELETE /users/{id}
    // -------------------------------------------------------------------------

    /**
     * Remove um usuário do sistema.
     *
     * <p>Um administrador não pode excluir a própria conta.
     * Um GESTOR não pode excluir usuários ADMIN ou GESTOR.</p>
     *
     * @param id        identificador UUID do usuário a ser removido.
     * @param requester usuário autenticado extraído do token JWT.
     * @return {@code 204 No Content} em caso de sucesso.
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "Excluir usuário", description = "Remove o usuário. Admin não pode excluir a própria conta.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Usuário removido com sucesso"),
            @ApiResponse(responseCode = "404", description = "Usuário não encontrado"),
            @ApiResponse(responseCode = "409", description = "Tentativa de auto-exclusão"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<Void> deleteUser(
            @PathVariable UUID id,
            @AuthenticationPrincipal User requester
    ) {
        userService.deleteUser(id, requester);
        return ResponseEntity.noContent().build();
    }
}