package com.hermes.controller;

import com.hermes.dto.PageResponseDTO;
import com.hermes.dto.user.UserListResponseDTO;
import com.hermes.dto.user.UserRequestDTO;
import com.hermes.dto.user.UserResponseDTO;
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
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Controller REST para gerenciamento de usuários.
 *
 * <p>Todos os endpoints deste controller requerem autenticação e papel {@code ADMIN}.
 * A autorização é reforçada em dois níveis: na configuração do {@code SecurityConfig}
 * (regra de URL) e via {@code @PreAuthorize} em cada método (defesa em profundidade).</p>
 *
 * <p>Base path: {@code /users}</p>
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Usuários", description = "Gerenciamento de usuários — exclusivo para ADMIN")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    // -------------------------------------------------------------------------
    // GET /users
    // -------------------------------------------------------------------------

    /**
     * Lista usuários de forma paginada com filtros opcionais.
     *
     * @param page     índice da página (0-based, padrão 0).
     * @param limit    itens por página (padrão 10).
     * @param role     filtra por papel: {@code ADMIN} ou {@code USER} (opcional).
     * @param isActive filtra por situação da conta (opcional).
     * @return página de {@link UserListResponseDTO}.
     */
    @GetMapping
    @Operation(summary = "Listar usuários", description = "Retorna lista paginada com filtros opcionais por role e isActive")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listagem retornada com sucesso"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — apenas ADMIN")
    })
    public ResponseEntity<PageResponseDTO<UserListResponseDTO>> listUsers(
            @Parameter(description = "Índice da página (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Itens por página") @RequestParam(defaultValue = "10") int limit,
            @Parameter(description = "Filtro por papel (ADMIN | USER)") @RequestParam(required = false) UserRole role,
            @Parameter(description = "Filtro por situação da conta") @RequestParam(required = false) Boolean isActive
    ) {
        Page<UserListResponseDTO> result = userService.listUsers(page, limit, role, isActive);
        return ResponseEntity.ok(PageResponseDTO.from(result, page + 1, limit));
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
            @ApiResponse(responseCode = "403", description = "Acesso negado — apenas ADMIN")
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
     * <p>A senha é gerada automaticamente pelo backend e enviada por e-mail ao
     * endereço informado. O campo {@code email} é obrigatório nesta operação.</p>
     *
     * @param dto dados do novo usuário.
     * @return {@link UserResponseDTO} com status {@code 201 Created}.
     */
    @PostMapping
    @Operation(summary = "Criar usuário", description = "Gera senha aleatória e envia por e-mail ao usuário criado")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Usuário criado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "409", description = "E-mail já cadastrado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — apenas ADMIN")
    })
    public ResponseEntity<UserResponseDTO> createUser(@Valid @RequestBody UserRequestDTO dto) {
        UserResponseDTO response = userService.createUser(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // -------------------------------------------------------------------------
    // PUT /users/{id}
    // -------------------------------------------------------------------------

    /**
     * Atualiza os dados de um usuário existente.
     *
     * <p>O campo {@code email} é ignorado pelo serviço — o e-mail é imutável
     * após a criação do usuário.</p>
     *
     * @param id  identificador UUID do usuário.
     * @param dto dados a atualizar ({@code name}, {@code role}, {@code isActive}).
     * @return {@link UserResponseDTO} atualizado.
     */
    @PutMapping("/{id}")
    @Operation(summary = "Atualizar usuário", description = "Edita name, role e isActive. O e-mail é imutável.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Usuário atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "404", description = "Usuário não encontrado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — apenas ADMIN")
    })
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserRequestDTO dto
    ) {
        return ResponseEntity.ok(userService.updateUser(id, dto));
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
            @ApiResponse(responseCode = "403", description = "Acesso negado — apenas ADMIN")
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
     * <p>Um administrador não pode excluir a própria conta.</p>
     *
     * @param id identificador UUID do usuário a ser removido.
     * @return {@code 204 No Content} em caso de sucesso.
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "Excluir usuário", description = "Remove o usuário. Um admin não pode excluir a própria conta.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Usuário removido com sucesso"),
            @ApiResponse(responseCode = "404", description = "Usuário não encontrado"),
            @ApiResponse(responseCode = "409", description = "Tentativa de auto-exclusão"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — apenas ADMIN")
    })
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
