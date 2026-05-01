package com.hermes.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.security.JwtAuthFilter;
import com.hermes.security.UserDetailsServiceImpl;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpMethod.*;

/**
 * Configuração central de segurança do HERMES.
 *
 * <p>Implementa autenticação stateless via JWT e API Key, com regras de autorização
 * por role e CORS configurável via propriedade. Segue o modelo moderno do Spring
 * Security 6 (sem {@code WebSecurityConfigurerAdapter}).</p>
 *
 * <p><b>Estratégia de autenticação:</b> O {@link JwtAuthFilter} intercepta cada
 * requisição e valida o token JWT (Bearer) ou API Key (X-API-Key) antes de
 * chegar aos controllers. Sessões HTTP são completamente desabilitadas.</p>
 *
 * <p><b>CSRF:</b> Desabilitado intencionalmente — APIs REST stateless com JWT
 * não precisam de proteção CSRF, pois tokens não são enviados automaticamente
 * pelo browser como cookies de sessão.</p>
 *
 * @see JwtAuthFilter
 * @see UserDetailsServiceImpl
 */
@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsServiceImpl;

    /**
     * Origins permitidas para CORS, configuráveis via {@code hermes.cors.allowed-origins}.
     * Suporta múltiplos valores separados por vírgula.
     * Exemplo: {@code http://localhost:5173,https://hermes.empresa.com}
     */
    @Value("${hermes.cors.allowed-origins}")
    private String allowedOrigins;

    /**
     * Cadeia de filtros de segurança principal do HERMES.
     *
     * <p>Define as regras de acesso por endpoint e role, configura o tratamento
     * de erros de autenticação/autorização com respostas JSON padronizadas,
     * e insere o {@link JwtAuthFilter} no pipeline antes do filtro padrão do Spring.</p>
     *
     * <p><b>Hierarquia de regras:</b> As regras mais específicas devem vir antes
     * das mais genéricas — {@code hasRole("ADMIN")} para mutações antes de
     * {@code authenticated()} para leituras.</p>
     *
     * @param http o construtor de configuração HTTP fornecido pelo Spring
     * @return a cadeia de filtros configurada e pronta para uso
     * @throws Exception se a configuração do HttpSecurity falhar
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        log.info("Inicializando SecurityFilterChain do HERMES");

        http
            // CSRF desabilitado: API REST stateless com JWT — tokens não são cookies,
            // portanto ataques CSRF não se aplicam neste modelo de autenticação.
            .csrf(AbstractHttpConfigurer::disable)

            // CORS configurado via bean dedicado, com origins controladas por propriedade.
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // Sessão HTTP completamente stateless — Spring não cria nem usa HttpSession.
            // Cada requisição é autenticada independentemente via JWT/API Key.
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Regras de autorização por endpoint e método HTTP.
            .authorizeHttpRequests(auth -> auth

                // ─── Liberar preflight CORS ────────────────────────────────────
                .requestMatchers(OPTIONS, "/**").permitAll()

                // ─── Endpoints públicos ────────────────────────────────────────────
                // Login e refresh não exigem autenticação prévia.
                .requestMatchers(POST, "/auth/login", "/auth/refresh").permitAll()

                // Documentação Swagger — acessível sem autenticação para facilitar
                // integração e exploração da API pelos times consumidores.
                .requestMatchers(
                    "/swagger-ui/**",
                    "/api-docs/**",
                    "/swagger-ui.html"
                ).permitAll()

                // ─── Endpoints autenticados — apenas leitura de templates ──────────
                // Templates podem ser consultados por qualquer usuário autenticado,
                // mas apenas ADMINs podem criar, editar ou excluir.
                .requestMatchers(GET, "/templates/**").authenticated()

                // ─── Endpoints exclusivos de ADMIN — gestão de templates ──────────
                .requestMatchers(POST, "/templates").hasRole("ADMIN")
                .requestMatchers(PUT, "/templates/**").hasRole("ADMIN")
                .requestMatchers(DELETE, "/templates/**").hasRole("ADMIN")

                // Versões de templates também são gerenciadas apenas por ADMINs.
                .requestMatchers(POST, "/templates/*/versions").hasRole("ADMIN")
                .requestMatchers(PUT, "/templates/*/versions/**").hasRole("ADMIN")

                // ─── Endpoints autenticados — notificações e dashboard ────────────
                .requestMatchers("/notifications/**").authenticated()
                .requestMatchers("/dashboard/**").authenticated()

                // Perfil e logout exigem autenticação válida.
                .requestMatchers("/auth/me", "/auth/logout").authenticated()

                // Qualquer outro endpoint não mapeado exige autenticação por padrão.
                .anyRequest().authenticated()
            )

            // Tratamento customizado de erros de segurança com respostas JSON.
            // Evita redirecionamentos para páginas de login (comportamento padrão do Spring).
            .exceptionHandling(ex -> ex

                // 401 Unauthorized — token ausente, inválido ou expirado.
                .authenticationEntryPoint((request, response, authException) -> {
                    log.warn("Tentativa de acesso não autenticado: {} {}",
                        request.getMethod(), request.getRequestURI());
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(
                        new ObjectMapper().writeValueAsString(Map.of(
                            "error", "Não autenticado",
                            "message", "Token JWT ausente, inválido ou expirado",
                            "status", 401
                        ))
                    );
                })

                // 403 Forbidden — autenticado, mas sem permissão para o recurso.
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    log.warn("Acesso negado para usuário autenticado: {} {}",
                        request.getMethod(), request.getRequestURI());
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(
                        new ObjectMapper().writeValueAsString(Map.of(
                            "error", "Acesso negado",
                            "message", "Você não tem permissão para acessar este recurso",
                            "status", 403
                        ))
                    );
                })
            )

            // Insere o filtro JWT antes do filtro padrão de autenticação por usuário/senha.
            // O JwtAuthFilter popula o SecurityContext se o token for válido,
            // permitindo que os filtros subsequentes reconheçam o usuário autenticado.
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Gerenciador de autenticação exposto como bean para uso nos services de autenticação.
     *
     * <p>Necessário para que o {@code AuthService} possa chamar
     * {@code authenticationManager.authenticate()} durante o login,
     * delegando a validação ao {@link DaoAuthenticationProvider}.</p>
     *
     * @param config a configuração de autenticação gerenciada pelo Spring
     * @return o {@link AuthenticationManager} configurado
     * @throws Exception se a extração do manager falhar
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Provider de autenticação que valida credenciais contra o banco de dados.
     *
     * <p>Combina o {@link UserDetailsServiceImpl} (que carrega o usuário pelo email)
     * com o {@link BCryptPasswordEncoder} (que valida a senha hasheada).
     * Registrado automaticamente no contexto de autenticação do Spring.</p>
     *
     * @return o provider configurado com serviço de usuários e encoder de senha
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsServiceImpl);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /**
     * Encoder de senha usando BCrypt com fator de custo padrão (10 rounds).
     *
     * <p>BCrypt é o algoritmo recomendado para hashing de senhas em sistemas modernos:
     * lento por design (resistente a ataques de força bruta), com salt automático
     * (resistente a rainbow tables) e fator de custo ajustável conforme hardware evolui.</p>
     *
     * @return instância de {@link BCryptPasswordEncoder}
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Configuração de CORS (Cross-Origin Resource Sharing) para a API do HERMES.
     *
     * <p>Permite que o frontend React (rodando em origem diferente) consuma a API.
     * As origins permitidas são configuráveis via {@code hermes.cors.allowed-origins},
     * suportando múltiplos valores para ambientes de dev/homologação/prod.</p>
     *
     * <p><b>Headers expostos:</b> {@code Authorization} é exposto para que o frontend
     * consiga ler o access token retornado em respostas de refresh.</p>
     *
     * <p><b>Credentials:</b> Habilitado ({@code allowCredentials=true}) para suportar
     * cookies httpOnly usados no transporte do refresh token.</p>
     *
     * @return a fonte de configuração CORS registrada para todos os paths da API
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.asList(allowedOrigins.split(","));

        // Origins configuráveis via propriedade — nunca hardcoded.
        config.setAllowedOrigins(origins);

        // Métodos HTTP permitidos, incluindo OPTIONS para preflight do browser.
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        // Headers aceitos: Authorization (JWT Bearer), Content-Type (JSON),
        // X-API-Key (autenticação programática por API Key).
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-API-Key"));

        // Expõe o header Authorization para que o cliente possa ler o access token
        // em respostas de autenticação (ex: POST /auth/refresh).
        config.setExposedHeaders(List.of("Authorization"));

        // Necessário para suporte a cookies httpOnly (refresh token).
        // Requer que allowedOrigins seja específico (não "*").
        config.setAllowCredentials(true);

        // Cache do resultado do preflight OPTIONS por 1 hora, reduzindo latência.
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        log.info("CORS configurado para origins: {}", origins);
        return source;
    }
}