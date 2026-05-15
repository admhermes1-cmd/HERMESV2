package com.hermes.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuração da documentação OpenAPI 3.0 do HERMES via SpringDoc.
 *
 * <p>Expõe a documentação interativa da API em {@code /swagger-ui.html} e
 * o schema JSON/YAML em {@code /api-docs}. Os endpoints do Swagger são
 * liberados sem autenticação no {@link SecurityConfig} para facilitar
 * a integração pelos times consumidores.</p>
 *
 * <p><b>Esquemas de autenticação documentados:</b></p>
 * <ul>
 *   <li><b>bearerAuth:</b> JWT Bearer token obtido em {@code POST /auth/login}</li>
 *   <li><b>apiKey:</b> API Key via header {@code X-API-Key} para integrações programáticas</li>
 * </ul>
 *
 * <p><b>Grupos de API:</b> A documentação é dividida em dois grupos para facilitar
 * a navegação — endpoints públicos de autenticação e endpoints protegidos de negócio.</p>
 *
 * @see <a href="https://springdoc.org/">SpringDoc OpenAPI</a>
 */
@Configuration
public class OpenApiConfig {

    /**
     * Define os metadados globais da API e os esquemas de segurança aceitos.
     *
     * <p>O {@link SecurityRequirement} adicionado via {@code addSecurityItem} aplica
     * {@code bearerAuth} como esquema padrão em todos os endpoints documentados.
     * Endpoints públicos podem sobrescrever isso com {@code @SecurityRequirements({})}
     * nos controllers, se necessário.</p>
     *
     * <p>Ambos os esquemas ({@code bearerAuth} e {@code apiKey}) são registrados
     * nos {@link Components} para que possam ser referenciados individualmente
     * por operações específicas usando {@code @SecurityRequirement} no nível do método.</p>
     *
     * @return a configuração completa de metadados e segurança da API
     */
    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("HERMES API")
                .description("""
                    Sistema Central de Notificações — John Deere Fatec Challenge
                    
                    API REST para gerenciamento de templates, envio e agendamento \
                    de comunicações multicanal.
                    
                    ## Autenticação
                    
                    A API suporta dois mecanismos de autenticação:
                    
                    - **Bearer JWT**: Obtenha o access token via `POST /auth/login` e inclua \
                    no header `Authorization: Bearer {token}`
                    - **API Key**: Inclua sua chave no header `X-API-Key: {sua-chave}` para \
                    integrações programáticas entre sistemas
                    
                    ## Expiração de tokens
                    
                    - Access token: configurável via `JWT_EXPIRATION` (padrão: 1 hora)
                    - Refresh token: configurável via `JWT_REFRESH_EXPIRATION` (padrão: 7 dias)
                    """)
                .version("1.0.0")
                .contact(new Contact()
                    .name("Time HERMES")
                    .email("hermes@fatec.com"))
                .license(new License()
                    .name("Privado — John Deere / Fatec Indaiatuba")))

            // Aplica bearerAuth como requisito de segurança padrão para toda a API.
            // Endpoints públicos (/auth/login, /auth/refresh) não exigem autenticação,
            // mas o Swagger UI exibirá o botão de autenticação para facilitar o teste.
            .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))

            .components(new Components()
                // ── Esquema 1: JWT Bearer Token ──────────────────────────────────────
                // Autenticação padrão para usuários humanos via login interativo.
                .addSecuritySchemes("bearerAuth",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("""
                            Access token JWT obtido em `POST /auth/login`.
                            
                            Inclua no header: `Authorization: Bearer {access_token}`
                            
                            Quando o access token expirar, utilize `POST /auth/refresh` \
                            com o refresh token para obter um novo par de tokens.
                            """))

                // ── Esquema 2: API Key via Header ────────────────────────────────────
                // Autenticação para integrações machine-to-machine entre sistemas internos.
                // A API Key é gerada automaticamente no cadastro do usuário (@PrePersist).
                .addSecuritySchemes("apiKey",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER)
                        .name("X-API-Key")
                        .description("""
                            API Key do usuário para autenticação programática.
                            
                            Ideal para integrações machine-to-machine onde o fluxo de login \
                            interativo não é viável.
                            
                            Inclua no header: `X-API-Key: {sua-api-key}`
                            
                            A API Key é gerada automaticamente na criação do usuário e \
                            pode ser consultada via `GET /auth/me`.
                            """)))

            .externalDocs(new ExternalDocumentation()
                .description("Repositório do projeto")
                .url("https://github.com/hermes-fatec"));
    }

    /**
     * Agrupa os endpoints públicos de autenticação para navegação separada no Swagger UI.
     *
     * <p>Endpoints de autenticação são acessíveis sem token, portanto faz sentido
     * agrupá-los visualmente para facilitar o onboarding de novos integradores.</p>
     *
     * @return grupo de documentação para endpoints de autenticação
     */
    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder()
            .group("public")
            .displayName("Autenticação (público)")
            .pathsToMatch("/auth/**")
            .addOpenApiCustomizer(openApi ->
                openApi.info(new Info()
                    .title("HERMES API — Autenticação")
                    .description("Endpoints públicos de autenticação: login, refresh e perfil")
                    .version("1.0.0")))
            .build();
    }

    /**
     * Agrupa os endpoints protegidos de negócio para navegação separada no Swagger UI.
     *
     * <p>Cobre os recursos principais do HERMES: templates de mensagens,
     * notificações (envio e agendamento) e métricas do dashboard.</p>
     *
     * <p>Todos os endpoints deste grupo requerem autenticação (JWT ou API Key).</p>
     *
     * @return grupo de documentação para endpoints protegidos de negócio
     */
    @Bean
    public GroupedOpenApi protectedApi() {
        return GroupedOpenApi.builder()
            .group("protected")
            .displayName("API de Negócio (autenticado)")
            .pathsToMatch("/templates/**", "/notifications/**", "/dashboard/**")
            .addOpenApiCustomizer(openApi ->
                openApi.info(new Info()
                    .title("HERMES API — Negócio")
                    .description("""
                        Endpoints protegidos — requerem autenticação via Bearer JWT ou API Key.
                        
                        - **/templates**: Gerenciamento de templates de mensagens (ADMIN para mutações)
                        - **/notifications**: Envio, agendamento e rastreamento de notificações
                        - **/dashboard**: Métricas e estatísticas de envio em tempo real
                        """)
                    .version("1.0.0")))
            .build();
    }
}