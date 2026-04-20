package com.hermes.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * Componente utilitário responsável pela geração, validação e extração de dados
 * de tokens JWT utilizados no sistema HERMES.
 *
 * <p>Suporta dois tipos de token:
 * <ul>
 *   <li><b>access</b> — token de curta duração enviado no header {@code Authorization: Bearer}.</li>
 *   <li><b>refresh</b> — token de longa duração armazenado em cookie {@code httpOnly}.</li>
 * </ul>
 *
 * <p>Este componente é um singleton gerenciado pelo Spring. Toda lógica de parse
 * está centralizada em {@link #extractAllClaims(String)} para evitar duplicação.
 *
 * <p><b>Thread-safety:</b> não há estado mutável após a inicialização via
 * {@link #init()}, portanto o componente é seguro para uso concorrente.
 */
@Slf4j
@Component
public class JwtUtil {

    /**
     * Segredo JWT injetado a partir de {@code hermes.jwt.secret} no {@code application.yml}.
     * Deve ter no mínimo 256 bits (32 caracteres) para uso com HMAC-SHA256.
     */
    @Value("${hermes.jwt.secret}")
    private String secret;

    /**
     * Tempo de expiração do access token em milissegundos.
     * Padrão: 3600000 ms (1 hora).
     */
    @Value("${hermes.jwt.expiration:3600000}")
    private long expiration;

    /**
     * Tempo de expiração do refresh token em milissegundos.
     * Padrão: 604800000 ms (7 dias).
     */
    @Value("${hermes.jwt.refresh-expiration:604800000}")
    private long refreshExpiration;

    /**
     * Chave de assinatura derivada do segredo configurado.
     * Inicializada uma única vez em {@link #init()} após a injeção de dependências.
     */
    private SecretKey signingKey;

    /**
     * Inicializa a chave de assinatura HMAC-SHA a partir do segredo configurado.
     * Executado pelo Spring após a injeção de todas as propriedades.
     *
     * @throws IllegalArgumentException se o segredo for insuficiente para HMAC-SHA256
     */
    @PostConstruct
    public void init() {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        log.info("JwtUtil inicializado. Expiração do access token: {}ms, refresh token: {}ms",
                expiration, refreshExpiration);
    }

    // -------------------------------------------------------------------------
    // Geração de tokens
    // -------------------------------------------------------------------------

    /**
     * Gera um access token JWT para o usuário autenticado.
     *
     * <p>Claims incluídas:
     * <ul>
     *   <li>{@code sub} — email do usuário (subject)</li>
     *   <li>{@code role} — papel do usuário (ex.: {@code ADMIN}, {@code USER})</li>
     *   <li>{@code userId} — UUID do usuário como String</li>
     *   <li>{@code type} — literal {@code "access"}</li>
     * </ul>
     *
     * @param userDetails detalhes do usuário autenticado; deve ser uma instância de
     *                    {@code com.hermes.entity.User} para extração de role e userId
     * @return JWT compacto e assinado pronto para ser enviado ao cliente
     */
    public String generateAccessToken(UserDetails userDetails) {
        com.hermes.entity.User user = (com.hermes.entity.User) userDetails;
        Date now = new Date();

        return Jwts.builder()
                .subject(user.getEmail())
                .claim("role", user.getRole().name())
                .claim("userId", user.getId().toString())
                .claim("type", "access")
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiration))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Gera um refresh token JWT para o usuário autenticado.
     *
     * <p>O refresh token carrega apenas as claims mínimas necessárias para
     * identificar o usuário e renovar o access token, sem expor dados sensíveis.
     *
     * <p>Claims incluídas:
     * <ul>
     *   <li>{@code sub} — email do usuário</li>
     *   <li>{@code type} — literal {@code "refresh"}</li>
     * </ul>
     *
     * @param userDetails detalhes do usuário autenticado
     * @return JWT compacto e assinado com expiração longa
     */
    public String generateRefreshToken(UserDetails userDetails) {
        com.hermes.entity.User user = (com.hermes.entity.User) userDetails;
        Date now = new Date();

        return Jwts.builder()
                .subject(user.getEmail())
                .claim("type", "refresh")
                .issuedAt(now)
                .expiration(new Date(now.getTime() + refreshExpiration))
                .signWith(signingKey)
                .compact();
    }

    // -------------------------------------------------------------------------
    // Extração de claims
    // -------------------------------------------------------------------------

    /**
     * Extrai o email do usuário (claim {@code sub}) contido no token.
     *
     * @param token JWT a ser lido
     * @return email do usuário
     * @throws JwtException se o token for inválido, mal-formado ou expirado
     */
    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    /**
     * Extrai o papel (role) do usuário contido na claim {@code role} do token.
     *
     * @param token JWT a ser lido
     * @return role do usuário como String (ex.: {@code "ADMIN"})
     * @throws JwtException se o token for inválido ou expirado
     */
    public String extractRole(String token) {
        return extractAllClaims(token).get("role", String.class);
    }

    /**
     * Extrai o identificador único do usuário (claim {@code userId}) do token.
     *
     * @param token JWT a ser lido
     * @return UUID do usuário
     * @throws JwtException        se o token for inválido ou expirado
     * @throws IllegalArgumentException se a claim {@code userId} estiver ausente ou mal-formada
     */
    public UUID extractUserId(String token) {
        String userId = extractAllClaims(token).get("userId", String.class);
        return UUID.fromString(userId);
    }

    /**
     * Extrai o tipo do token (claim {@code type}).
     *
     * @param token JWT a ser lido
     * @return {@code "access"} ou {@code "refresh"}
     * @throws JwtException se o token for inválido ou expirado
     */
    public String extractTokenType(String token) {
        return extractAllClaims(token).get("type", String.class);
    }

    /**
     * Retorna a data de expiração (claim {@code exp}) do token.
     *
     * @param token JWT a ser lido
     * @return data de expiração do token
     * @throws JwtException se o token for inválido ou expirado
     */
    public Date extractExpiration(String token) {
        return extractAllClaims(token).getExpiration();
    }

    // -------------------------------------------------------------------------
    // Validação
    // -------------------------------------------------------------------------

    /**
     * Valida o token verificando assinatura, expiração e tipo esperado.
     *
     * <p>Retorna {@code false} (em vez de lançar exceção) para facilitar o uso
     * no filtro de autenticação sem necessidade de captura de exceção no call site.
     *
     * @param token        JWT a validar
     * @param expectedType tipo esperado: {@code "access"} ou {@code "refresh"}
     * @return {@code true} se o token for válido, não expirado e do tipo correto;
     *         {@code false} caso contrário
     */
    public boolean isTokenValid(String token, String expectedType) {
        try {
            Claims claims = extractAllClaims(token);
            boolean notExpired = !claims.getExpiration().before(new Date());
            boolean typeMatches = expectedType.equals(claims.get("type", String.class));
            return notExpired && typeMatches;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Token inválido: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Verifica se o token já expirou.
     *
     * @param token JWT a verificar
     * @return {@code true} se a data de expiração já passou; {@code false} se ainda válido
     * @throws JwtException se o token for inválido ou mal-formado
     */
    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    // -------------------------------------------------------------------------
    // Métodos privados
    // -------------------------------------------------------------------------

    /**
     * Parseia o JWT e retorna todas as claims contidas no payload.
     *
     * <p>Este método é o ponto central de parse: toda extração de claim deve
     * passar por aqui para garantir que a assinatura seja sempre verificada.
     *
     * @param token JWT compacto a ser parseado
     * @return claims do payload validado
     * @throws io.jsonwebtoken.security.SignatureException se a assinatura for inválida
     * @throws io.jsonwebtoken.ExpiredJwtException        se o token estiver expirado
     * @throws io.jsonwebtoken.MalformedJwtException      se o token estiver mal-formado
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}