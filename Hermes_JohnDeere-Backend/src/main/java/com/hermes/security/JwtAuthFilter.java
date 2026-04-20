package com.hermes.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtro de autenticação do HERMES responsável por interceptar todas as requisições
 * HTTP e populá-las com o contexto de segurança do Spring, quando possível.
 *
 * <p>Suporta dois mecanismos de autenticação, aplicados nesta ordem de prioridade:
 * <ol>
 *   <li><b>JWT via header {@code Authorization: Bearer &lt;token&gt;}</b> — fluxo padrão
 *       para usuários interativos autenticados via {@code POST /auth/login}.</li>
 *   <li><b>API Key via header {@code X-API-Key: &lt;key&gt;}</b> — fallback para
 *       sistemas externos que se integram programaticamente ao HERMES.</li>
 * </ol>
 *
 * <p>Estende {@link OncePerRequestFilter} garantindo que a lógica de autenticação
 * seja executada <b>exatamente uma vez</b> por requisição, mesmo em ambientes com
 * filtros encadeados ou forward/include do Servlet.
 *
 * <p><b>Política de erros:</b> exceções de autenticação (token inválido, usuário não
 * encontrado, etc.) são capturadas e logadas, mas nunca propagadas. A filter chain
 * prossegue normalmente e o Spring Security retornará {@code 401 Unauthorized} para
 * endpoints protegidos quando o {@link SecurityContextHolder} estiver vazio.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    /** Utilitário de geração e validação de JWTs. */
    private final JwtUtil jwtUtil;

    /** Serviço de carregamento de usuários por email e por API Key. */
    private final UserDetailsServiceImpl userDetailsService;

    // -------------------------------------------------------------------------
    // Filtro principal
    // -------------------------------------------------------------------------

    /**
     * Lógica central do filtro: tenta autenticar a requisição via JWT ou API Key
     * e, independentemente do resultado, repassa o controle para o próximo filtro
     * da cadeia.
     *
     * <p>O {@link SecurityContextHolder} é populado apenas se:
     * <ul>
     *   <li>O token / API Key for válido e não expirado.</li>
     *   <li>Ainda não houver uma autenticação ativa no contexto (evita reautenticação).</li>
     * </ul>
     *
     * @param request     requisição HTTP recebida
     * @param response    resposta HTTP a ser enviada
     * @param filterChain cadeia de filtros do Servlet
     * @throws ServletException em caso de erro de Servlet não relacionado à autenticação
     * @throws IOException      em caso de erro de I/O ao continuar a cadeia
     */
    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // ------------------------------------------------------------------
        // 1. Tentativa de autenticação via JWT (Authorization: Bearer <token>)
        // ------------------------------------------------------------------
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            tryAuthenticateWithJwt(token, request);
        }

        // ------------------------------------------------------------------
        // 2. Fallback: autenticação via API Key (X-API-Key: <key>)
        //    Executado apenas se nenhuma autenticação foi estabelecida acima.
        // ------------------------------------------------------------------
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String apiKey = request.getHeader("X-API-Key");
            if (apiKey != null && !apiKey.isBlank()) {
                tryAuthenticateWithApiKey(apiKey, request);
            }
        }

        // ------------------------------------------------------------------
        // 3. Sempre continuar a filter chain — Spring Security decide o acesso.
        // ------------------------------------------------------------------
        filterChain.doFilter(request, response);
    }

    // -------------------------------------------------------------------------
    // Mecanismo 1 — Autenticação por JWT
    // -------------------------------------------------------------------------

    /**
     * Tenta autenticar a requisição usando o JWT fornecido.
     *
     * <p>O processo consiste em:
     * <ol>
     *   <li>Extrair o email do subject do token.</li>
     *   <li>Verificar que não há autenticação prévia no contexto.</li>
     *   <li>Carregar o {@link UserDetails} correspondente ao email.</li>
     *   <li>Validar o token (assinatura, expiração e tipo {@code "access"}).</li>
     *   <li>Setar a autenticação no {@link SecurityContextHolder}.</li>
     * </ol>
     *
     * <p>Qualquer falha neste processo é tratada silenciosamente — o contexto
     * permanece vazio e o Spring Security aplicará as regras de acesso configuradas.
     *
     * @param token   JWT extraído do header {@code Authorization}
     * @param request requisição atual, usada para popular os detalhes de autenticação
     */
    private void tryAuthenticateWithJwt(String token, HttpServletRequest request) {
        try {
            String email = jwtUtil.extractEmail(token);

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                if (jwtUtil.isTokenValid(token, "access")) {
                    setAuthentication(userDetails, request);
                    log.debug("Autenticação JWT bem-sucedida para: {} [{}]",
                            email, request.getServletPath());
                } else {
                    log.warn("Token JWT inválido ou expirado para o usuário: {} — path: {}",
                            email, request.getServletPath());
                }
            }

        } catch (JwtException e) {
            log.warn("Falha ao parsear JWT — {}: {} — path: {}",
                    e.getClass().getSimpleName(), e.getMessage(), request.getServletPath());
        } catch (UsernameNotFoundException e) {
            log.warn("Usuário do token JWT não encontrado: {} — path: {}",
                    e.getMessage(), request.getServletPath());
        } catch (Exception e) {
            log.warn("Erro inesperado durante autenticação JWT — {}: {} — path: {}",
                    e.getClass().getSimpleName(), e.getMessage(), request.getServletPath());
        }
    }

    // -------------------------------------------------------------------------
    // Mecanismo 2 — Autenticação por API Key
    // -------------------------------------------------------------------------

    /**
     * Tenta autenticar a requisição usando a API Key fornecida no header {@code X-API-Key}.
     *
     * <p>Este mecanismo é voltado para integração programática de sistemas externos
     * (outros microsserviços, scripts, pipelines de CI/CD, etc.) que não passam
     * pelo fluxo de login interativo.
     *
     * <p>Falhas são tratadas silenciosamente, mantendo o mesmo comportamento da
     * autenticação por JWT.
     *
     * @param apiKey  valor do header {@code X-API-Key}
     * @param request requisição atual
     */
    private void tryAuthenticateWithApiKey(String apiKey, HttpServletRequest request) {
        try {
            UserDetails userDetails = userDetailsService.loadUserByApiKey(apiKey);
            setAuthentication(userDetails, request);
            log.debug("Autenticação via API Key bem-sucedida para: {} — path: {}",
                    userDetails.getUsername(), request.getServletPath());

        } catch (UsernameNotFoundException e) {
            log.warn("API Key inválida ou não cadastrada — path: {}", request.getServletPath());
        } catch (Exception e) {
            log.warn("Erro inesperado durante autenticação por API Key — {}: {} — path: {}",
                    e.getClass().getSimpleName(), e.getMessage(), request.getServletPath());
        }
    }

    // -------------------------------------------------------------------------
    // Utilitário de contexto
    // -------------------------------------------------------------------------

    /**
     * Cria e registra o token de autenticação no {@link SecurityContextHolder}.
     *
     * <p>Utiliza {@link UsernamePasswordAuthenticationToken} com as authorities
     * extraídas do {@link UserDetails} e os detalhes da requisição HTTP, conforme
     * exigido pelo Spring Security para rastreamento correto de sessão (mesmo em
     * modo stateless).
     *
     * @param userDetails detalhes do usuário autenticado com authorities populadas
     * @param request     requisição HTTP atual para extração dos detalhes de rede
     */
    private void setAuthentication(UserDetails userDetails, HttpServletRequest request) {
        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                userDetails.getAuthorities()
        );
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authToken);
    }

    // -------------------------------------------------------------------------
    // Exclusão de endpoints públicos
    // -------------------------------------------------------------------------

    /**
     * Define os caminhos que devem ser excluídos do processamento deste filtro.
     *
     * <p>Endpoints públicos (login, refresh, documentação da API) não requerem
     * autenticação e não se beneficiam do overhead de validação de token, portanto
     * são excluídos para melhor desempenho.
     *
     * @param request requisição HTTP recebida
     * @return {@code true} se o filtro deve ser ignorado para esta requisição
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/auth/login")
                || path.startsWith("/auth/refresh")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/api-docs");
    }
}