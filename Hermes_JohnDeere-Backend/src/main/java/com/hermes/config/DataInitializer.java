package com.hermes.config;

import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import com.hermes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Inicializador de dados do HERMES — executa após o contexto Spring estar completamente pronto.
 *
 * <p>Responsável pelo seed inicial do banco de dados, criando o usuário administrador
 * padrão caso ainda não exista. Implementa {@link ApplicationRunner} para garantir que
 * o JPA e todos os beans estejam disponíveis antes da execução.</p>
 *
 * <p><b>Idempotência:</b> A criação do admin é verificada pelo email antes de inserir,
 * tornando o seed seguro para execuções repetidas (reinicializações, deploys).</p>
 *
 * <p><b>Falha segura:</b> Erros no seed são capturados e logados sem propagar a exceção,
 * evitando que um problema de inicialização de dados derrube toda a aplicação.</p>
 *
 * <p><b>Configuração via application.yml:</b></p>
 * <pre>
 * hermes:
 *   admin:
 *     email: ${ADMIN_EMAIL:admin@hermes.com}
 *     password: ${ADMIN_PASSWORD:admin123}
 *     name: ${ADMIN_NAME:Administrador}
 * </pre>
 *
 * @see ApplicationRunner
 * @see UserRepository
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * E-mail do usuário administrador padrão.
     * Configurável via variável de ambiente {@code ADMIN_EMAIL}.
     * Valor padrão: {@code admin@hermes.com}
     */
    @Value("${hermes.admin.email}")
    private String adminEmail;

    /**
     * Senha do usuário administrador padrão.
     *
     * <p>Em desenvolvimento, aceita senhas simples definidas em {@code application-dev.yml}.
     * Em produção, exigir senha forte via variável de ambiente {@code ADMIN_PASSWORD}.</p>
     *
     * <p><b>ATENÇÃO:</b> Nunca commitar senhas reais no repositório.
     * Sempre usar variáveis de ambiente em ambientes não-dev.</p>
     */
    @Value("${hermes.admin.password}")
    private String adminPassword;

    /**
     * Nome de exibição do usuário administrador padrão.
     * Configurável via variável de ambiente {@code ADMIN_NAME}.
     * Valor padrão: {@code Administrador}
     */
    @Value("${hermes.admin.name}")
    private String adminName;

    /**
     * Ponto de entrada do inicializador — executado automaticamente pelo Spring Boot
     * após o contexto estar pronto e antes da aplicação começar a aceitar requisições.
     *
     * <p>Delega para {@link #createAdminUserIfNotExists()} para manter o método
     * de entrada limpo e permitir extensão futura com outros seeds.</p>
     *
     * @param args argumentos da aplicação (não utilizados)
     */
    @Override
    public void run(ApplicationArguments args) {
        log.info("DataInitializer iniciado — verificando dados essenciais");
        createAdminUserIfNotExists();
        log.info("DataInitializer concluído com sucesso");
    }

    /**
     * Cria o usuário administrador padrão se ainda não existir no banco de dados.
     *
     * <p><b>Fluxo de execução:</b></p>
     * <ol>
     *   <li>Verifica se já existe um usuário com o email configurado</li>
     *   <li>Se existir: loga info e retorna sem alterar nada (idempotente)</li>
     *   <li>Se não existir: cria o admin com senha hasheada e persiste</li>
     *   <li>Emite aviso de segurança para alterar a senha em produção</li>
     * </ol>
     *
     * <p><b>API Key:</b> Gerada automaticamente pelo {@code @PrePersist} da entidade
     * {@code User} — não é necessário definir aqui.</p>
     *
     * <p><b>Tratamento de erro:</b> Qualquer exceção é capturada, logada com nível
     * {@code ERROR} e suprimida — uma falha no seed não deve impedir a inicialização
     * da aplicação, pois os dados essenciais podem já existir de execuções anteriores.</p>
     */
    private void createAdminUserIfNotExists() {
        try {
            // Verifica idempotência pelo email — evita duplicação em reinicializações.
            if (userRepository.existsByEmail(adminEmail)) {
                log.info("Usuário admin já existe — seed ignorado. Email: {}", adminEmail);
                return;
            }

            log.info("Criando usuário administrador padrão: {}", adminEmail);

            User admin = User.builder()
                .name(adminName)
                .email(adminEmail)
                // Senha armazenada como hash BCrypt — nunca em texto plano.
                .password(passwordEncoder.encode(adminPassword))
                .role(UserRole.ADMIN)
                // Admin ativo imediatamente, sem necessidade de confirmação.
                .active(true)
                // apiKey é gerada automaticamente no @PrePersist da entidade User.
                .build();

            userRepository.save(admin);

            log.info("Usuário admin criado com sucesso: {}", adminEmail);

            // Aviso de segurança explícito — deve aparecer nos logs de deploy
            // para lembrar o time de ops de configurar a senha forte em produção.
            log.warn("══════════════════════════════════════════════════════════════");
            log.warn("  ATENÇÃO: Altere a senha do admin em produção via variável");
            log.warn("  de ambiente ADMIN_PASSWORD. Nunca use a senha padrão em");
            log.warn("  ambientes expostos à internet.");
            log.warn("══════════════════════════════════════════════════════════════");

        } catch (Exception e) {
            // Falha no seed não derruba a aplicação — pode ser erro de conexão
            // temporário ou race condition em deploys blue-green com múltiplas instâncias.
            // Os dados podem já ter sido inseridos por outra instância.
            log.error(
                "Erro ao criar usuário admin durante inicialização. " +
                "A aplicação continuará normalmente. Verifique o banco de dados manualmente. " +
                "Causa: {}",
                e.getMessage(),
                e
            );
        }
    }
}
