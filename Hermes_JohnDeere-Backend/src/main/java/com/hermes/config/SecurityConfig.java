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
 * <p><strong>Hierarquia de roles:</strong></p>
 * <ul>
 *   <li>{@code ADMIN}  — acesso total a todos os endpoints.</li>
 *   <li>{@code GESTOR} — acesso a células (GET/PUT) e usuários.
 *       A validação de quais usuários pode operar é feita no {@code UserService},
 *       não aqui — o SecurityConfig apenas verifica autenticação e role mínimo.</li>
 *   <li>{@code USER}   — acesso restrito a templates (leitura), notificações e dashboard.</li>
 * </ul>
 *
 * <p><strong>Endpoints de células:</strong></p>
 * <ul>
 *   <li>GET /celulas/**       — ADMIN e GESTOR</li>
 *   <li>POST /celulas         — apenas ADMIN</li>
 *   <li>PUT /celulas/**       — ADMIN e GESTOR</li>
 *   <li>DELETE /celulas/**    — apenas ADMIN</li>
 * </ul>
 *
 * <p><strong>Endpoints de usuários:</strong></p>
 * <ul>
 *   <li>/users/**             — ADMIN e GESTOR (restrições de role-alvo no UserService)</li>
 * </ul>
 */
@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsServiceImpl;

    @Value("${hermes.cors.allowed-origins}")
    private String allowedOrigins;

    /**
     * Cadeia de filtros de segurança principal do HERMES.
     *
     * @param http o construtor de configuração HTTP fornecido pelo Spring
     * @return a cadeia de filtros configurada
     * @throws Exception se a configuração falhar
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        log.info("Inicializando SecurityFilterChain do HERMES");

        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            .authorizeHttpRequests(auth -> auth

                // ─── Preflight CORS ─────────────────────────────────────────
                .requestMatchers(OPTIONS, "/**").permitAll()

                // ─── Endpoints públicos ──────────────────────────────────────
                .requestMatchers(POST, "/auth/login", "/auth/refresh").permitAll()
                .requestMatchers(
                    "/swagger-ui/**", "/api-docs/**", "/swagger-ui.html"
                ).permitAll()

                // ─── Usuários — ADMIN e GESTOR ───────────────────────────────
                // A validação de quais usuários cada role pode operar é feita
                // no UserService.validateRoleTarget(), não aqui.
                .requestMatchers("/users/**").hasAnyRole("ADMIN", "GESTOR")

                // ─── Células — regras por método ─────────────────────────────
                .requestMatchers(GET,    "/celulas/**").hasAnyRole("ADMIN", "GESTOR")
                .requestMatchers(POST,   "/celulas").hasRole("ADMIN")
                .requestMatchers(PUT,    "/celulas/**").hasAnyRole("ADMIN", "GESTOR")
                .requestMatchers(DELETE, "/celulas/**").hasRole("ADMIN")

                // ─── Templates ───────────────────────────────────────────────
                .requestMatchers(GET, "/templates/**").authenticated()
                .requestMatchers(POST, "/templates").hasRole("ADMIN")
                .requestMatchers(PUT, "/templates/**").hasRole("ADMIN")
                .requestMatchers(DELETE, "/templates/**").hasRole("ADMIN")
                .requestMatchers(POST, "/templates/*/versions").hasRole("ADMIN")
                .requestMatchers(PUT, "/templates/*/versions/**").hasRole("ADMIN")

                // ─── Notificações, dashboard e perfil ────────────────────────
                .requestMatchers("/notifications/**").authenticated()
                .requestMatchers("/dashboard/**").authenticated()
                .requestMatchers("/auth/me", "/auth/logout").authenticated()

                .anyRequest().authenticated()
            )

            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    log.warn("Tentativa de acesso não autenticado: {} {}",
                        request.getMethod(), request.getRequestURI());
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(
                        new ObjectMapper().writeValueAsString(Map.of(
                            "error",   "Não autenticado",
                            "message", "Token JWT ausente, inválido ou expirado",
                            "status",  401
                        ))
                    );
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    log.warn("Acesso negado para usuário autenticado: {} {}",
                        request.getMethod(), request.getRequestURI());
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(
                        new ObjectMapper().writeValueAsString(Map.of(
                            "error",   "Acesso negado",
                            "message", "Você não tem permissão para acessar este recurso",
                            "status",  403
                        ))
                    );
                })
            )

            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsServiceImpl);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-API-Key"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        log.info("CORS configurado para origins: {}", origins);
        return source;
    }
}