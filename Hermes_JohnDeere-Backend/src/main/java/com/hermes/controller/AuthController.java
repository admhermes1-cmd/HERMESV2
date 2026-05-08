package com.hermes.controller;

import com.hermes.dto.auth.LoginRequestDTO;
import com.hermes.dto.auth.LoginResponseDTO;
import com.hermes.dto.user.ChangePasswordRequestDTO;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import com.hermes.security.JwtUtil;
import com.hermes.service.AuthService;
import com.hermes.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * Controller responsável pelos endpoints de autenticação do HERMES.
 * <p>
 * Gerencia login, logout, renovação de token e consulta de dados do usuário
 * autenticado. O refresh token é mantido em cookie httpOnly para segurança.
 * </p>
 *
 * @author HERMES Team
 */
@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Validated
@Tag(name = "Autenticação", description = "Endpoints de login, logout e refresh de token")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final UserService userService;

    /**
     * Autentica o usuário com email e senha.
     * <p>
     * Em caso de sucesso, retorna o access token no corpo da resposta e define
     * o refresh token em um cookie httpOnly, impedindo acesso via JavaScript.
     * </p>
     *
     * @param request  corpo com email e senha do usuário
     * @param response objeto de resposta HTTP para adição do cookie
     * @return {@link LoginResponseDTO} contendo dados do usuário e access token
     */
    @PostMapping("/login")
    @Operation(
            summary = "Login",
            description = "Autentica o usuário com email e senha. O refresh token é retornado em cookie httpOnly."
    )
    @ApiResponse(responseCode = "200", description = "Login realizado com sucesso")
    @ApiResponse(responseCode = "401", description = "Credenciais inválidas")
    public ResponseEntity<LoginResponseDTO> login(
            @RequestBody @Valid LoginRequestDTO request,
            HttpServletResponse response) {

        log.info("Tentativa de login para o email: {}", request.getEmail());

        LoginResponseDTO loginResponse = authService.login(request);

        Cookie refreshCookie = new Cookie("refreshToken", loginResponse.refreshToken());
        refreshCookie.setHttpOnly(true);
        refreshCookie.setSecure(true);
        refreshCookie.setPath("/auth/refresh");
        refreshCookie.setMaxAge(604800);
        response.addCookie(refreshCookie);

        log.info("Login realizado com sucesso para o email: {}", request.getEmail());

        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Renova o access token utilizando o refresh token presente no cookie.
     * <p>
     * O novo refresh token é definido no cookie, substituindo o anterior.
     * Se o cookie não estiver presente, lança exceção 401.
     * </p>
     *
     * @param refreshToken valor do cookie {@code refreshToken}, pode ser null
     * @param response     objeto de resposta HTTP para renovação do cookie
     * @return {@link LoginResponseDTO} com novo access token e dados do usuário
     */
    @PostMapping("/refresh")
    @Operation(
            summary = "Refresh Token",
            description = "Renova o access token usando o refresh token armazenado em cookie httpOnly."
    )
    @ApiResponse(responseCode = "200", description = "Token renovado com sucesso")
    @ApiResponse(responseCode = "401", description = "Refresh token inválido ou expirado")
    public ResponseEntity<LoginResponseDTO> refresh(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            HttpServletResponse response) {

        if (refreshToken == null) {
            throw AppException.unauthorized(ErrorCode.AUTH_TOKEN_INVALID, "Refresh token ausente");
        }

        log.info("Requisição de refresh token recebida");

        LoginResponseDTO loginResponse = authService.refresh(refreshToken);

        Cookie refreshCookie = new Cookie("refreshToken", loginResponse.refreshToken());
        refreshCookie.setHttpOnly(true);
        refreshCookie.setSecure(true);
        refreshCookie.setPath("/auth/refresh");
        refreshCookie.setMaxAge(604800);
        response.addCookie(refreshCookie);

        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Encerra a sessão do usuário invalidando o cookie de refresh token.
     * <p>
     * Define o cookie com {@code maxAge = 0}, forçando sua remoção pelo browser.
     * </p>
     *
     * @param response objeto de resposta HTTP para invalidação do cookie
     * @return 204 No Content
     */
    @PostMapping("/logout")
    @Operation(
            summary = "Logout",
            description = "Invalida a sessão do usuário removendo o cookie de refresh token."
    )
    @ApiResponse(responseCode = "204", description = "Logout realizado com sucesso")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        log.info("Logout requisitado");

        Cookie expiredCookie = new Cookie("refreshToken", "");
        expiredCookie.setHttpOnly(true);
        expiredCookie.setMaxAge(0);
        expiredCookie.setPath("/auth/refresh");
        response.addCookie(expiredCookie);

        return ResponseEntity.noContent().build();
    }

    /**
     * Troca a senha do usuário autenticado.
     *
     * <p>
     * Obrigatório no primeiro acesso (quando {@code mustChangePassword = true}).
     * Disponível também para qualquer usuário autenticado que deseje trocar sua senha.
     * </p>
     *
     * @param dto corpo com {@code currentPassword} e {@code newPassword}.
     * @return {@code 204 No Content} em caso de sucesso.
     */
    @PostMapping("/change-password")
    @Operation(
            summary = "Trocar senha",
            description = "Obrigatório no primeiro acesso. Valida política de senhas."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Senha alterada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Senha atual incorreta ou nova senha viola política"),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequestDTO dto) {

        userService.changePassword(
                dto.currentPassword(),
                dto.newPassword()
        );

        return ResponseEntity.noContent().build();
    }

    /**
     * Retorna os dados do usuário atualmente autenticado.
     * <p>
     * O email é extraído do {@link SecurityContextHolder} e utilizado para
     * buscar os dados completos do perfil via {@link AuthService}.
     * </p>
     *
     * @return {@link LoginResponseDTO.UserDTO} com dados do usuário autenticado
     */
    @GetMapping("/me")
    @Operation(
            summary = "Dados do usuário autenticado",
            description = "Retorna o perfil do usuário identificado pelo token JWT da requisição."
    )
    @ApiResponse(responseCode = "200", description = "Dados do usuário retornados com sucesso")
    @ApiResponse(responseCode = "401", description = "Usuário não autenticado")
    public ResponseEntity<LoginResponseDTO.UserDTO> getMe() {

        String email = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();

        LoginResponseDTO.UserDTO userDTO = authService.getMe(email);

        return ResponseEntity.ok(userDTO);
    }
}