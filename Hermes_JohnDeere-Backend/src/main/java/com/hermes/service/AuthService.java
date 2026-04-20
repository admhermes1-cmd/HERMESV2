package com.hermes.service;

import com.hermes.dto.auth.LoginRequestDTO;
import com.hermes.dto.auth.LoginResponseDTO;
import com.hermes.entity.User;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import com.hermes.repository.UserRepository;
import com.hermes.security.JwtUtil;
import com.hermes.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serviço de autenticação do HERMES.
 *
 * <p>Responsável pelo login de usuários, renovação de tokens JWT
 * e recuperação do perfil do usuário autenticado.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;

    /**
     * Autentica o usuário com e-mail e senha.
     *
     * <p>Delega a validação de credenciais ao {@link AuthenticationManager} do Spring Security.
     * Em caso de sucesso, gera um par de tokens JWT (access + refresh) e retorna os dados
     * do usuário autenticado.
     *
     * @param request DTO contendo e-mail e senha do usuário
     * @return {@link LoginResponseDTO} com tokens e dados do usuário
     * @throws AppException {@code AUTH_INVALID_CREDENTIALS} se as credenciais forem inválidas
     * @throws AppException {@code AUTH_USER_INACTIVE} se o usuário estiver inativo
     */
    @Transactional(readOnly = true)
    public LoginResponseDTO login(LoginRequestDTO request) {
        log.debug("Tentativa de login para: {}", request.getEmail());

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
        } catch (AuthenticationException ex) {
            log.warn("Falha de autenticação para: {} — {}", request.getEmail(), ex.getMessage());
            throw AppException.unauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS,
                    "E-mail ou senha inválidos.");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> AppException.unauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS,
                        "E-mail ou senha inválidos."));

        if (!user.isActive()) {
            log.warn("Login rejeitado — usuário inativo: {}", user.getId());
            throw AppException.forbidden(ErrorCode.AUTH_USER_INACTIVE,
                    "Conta de usuário inativa. Contate o administrador.");
        }

        String accessToken = jwtUtil.generateAccessToken(user);
        String refreshToken = jwtUtil.generateRefreshToken(user);

        log.info("Login bem-sucedido para usuário: {}", user.getId());
        return LoginResponseDTO.of(user, accessToken, refreshToken);
    }

    /**
     * Renova o access token a partir de um refresh token válido.
     *
     * <p>O refresh token não é rotacionado nesta operação — o mesmo token
     * de refresh é devolvido na resposta para manter a sessão ativa.
     *
     * @param refreshToken token de refresh emitido no momento do login
     * @return {@link LoginResponseDTO} com novo access token e o mesmo refresh token
     * @throws AppException {@code AUTH_TOKEN_INVALID} se o refresh token for inválido ou não for do tipo refresh
     * @throws AppException {@code AUTH_TOKEN_EXPIRED} se o refresh token estiver expirado
     */
    @Transactional(readOnly = true)
    public LoginResponseDTO refresh(String refreshToken) {
        log.debug("Solicitação de refresh token recebida");

        if (!jwtUtil.isTokenValid(refreshToken, "refresh")) {
            log.warn("Refresh token inválido ou expirado");
            throw AppException.unauthorized(ErrorCode.AUTH_TOKEN_INVALID,
                    "Refresh token inválido ou expirado.");
        }

        String email = jwtUtil.extractEmail(refreshToken);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.unauthorized(ErrorCode.AUTH_TOKEN_INVALID,
                        "Usuário vinculado ao token não encontrado."));

        if (!user.isActive()) {
            throw AppException.forbidden(ErrorCode.AUTH_USER_INACTIVE,
                    "Conta de usuário inativa.");
        }

        String newAccessToken = jwtUtil.generateAccessToken(user);

        log.info("Access token renovado para usuário: {}", user.getId());
        return LoginResponseDTO.of(user, newAccessToken, refreshToken);
    }

    /**
     * Retorna os dados do usuário autenticado na sessão atual.
     *
     * <p>O e-mail é extraído do JWT pelo controller via {@code SecurityContextHolder}
     * e repassado a este método para busca no repositório.
     *
     * @param email e-mail do usuário autenticado, extraído do token JWT pelo controller
     * @return {@link LoginResponseDTO.UserDTO} com os dados do usuário
     * @throws AppException {@code AUTH_INVALID_CREDENTIALS} se o usuário não for encontrado
     */
    @Transactional(readOnly = true)
    public LoginResponseDTO.UserDTO getMe(String email) {
        log.debug("Buscando dados do usuário autenticado: {}", email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound(ErrorCode.AUTH_INVALID_CREDENTIALS,
                        "Usuário autenticado não encontrado."));

        return LoginResponseDTO.UserDTO.from(user);
    }
}