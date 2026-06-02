package com.hermes.config;

import com.hermes.entity.Celula;
import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import com.hermes.repository.CelulaRepository;
import com.hermes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inicializador de dados do HERMES — executa após o contexto Spring estar completamente pronto.
 *
 * <p>Responsável pelo seed inicial do banco de dados:</p>
 * <ol>
 *   <li>Cria o usuário administrador padrão caso ainda não exista.</li>
 *   <li>Cria a célula padrão "C1" caso ainda não exista.</li>
 *   <li>Vincula o admin à célula C1 (para satisfazer a invariante de célula obrigatória).</li>
 * </ol>
 *
 * <p><strong>Idempotência:</strong> Todas as verificações usam {@code existsByEmail} /
 * {@code existsByNome} antes de inserir, tornando o seed seguro para múltiplas execuções.</p>
 *
 * <p><strong>Matrícula do admin:</strong> O admin é o primeiro usuário, então recebe
 * matrícula {@code 10000} diretamente no seed.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository   userRepository;
    private final CelulaRepository celulaRepository;
    private final PasswordEncoder  passwordEncoder;

    @Value("${hermes.admin.email}")
    private String adminEmail;

    @Value("${hermes.admin.password}")
    private String adminPassword;

    @Value("${hermes.admin.name}")
    private String adminName;

    /** Matrícula fixa do admin — sempre o primeiro usuário do sistema. */
    private static final int ADMIN_MATRICULA = 10000;

    /** Nome da célula padrão criada no seed. */
    private static final String CELULA_PADRAO_NOME = "C1";

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        log.info("DataInitializer iniciado — verificando dados essenciais");
        try {
            User admin = createAdminUserIfNotExists();
            createCelulaPadraoIfNotExists(admin);
        } catch (Exception e) {
            log.error(
                "Erro durante inicialização de dados. A aplicação continuará normalmente. Causa: {}",
                e.getMessage(), e
            );
        }
        log.info("DataInitializer concluído com sucesso");
    }

    /**
     * Cria o usuário administrador padrão se ainda não existir.
     * Retorna o admin (existente ou recém-criado) para uso no seed da célula.
     *
     * @return entidade {@link User} do administrador.
     */
    private User createAdminUserIfNotExists() {
        if (userRepository.existsByEmail(adminEmail)) {
            log.info("Usuário admin já existe — seed ignorado. Email: {}", adminEmail);
            return userRepository.findByEmail(adminEmail).orElseThrow();
        }

        log.info("Criando usuário administrador padrão: {}", adminEmail);

        User admin = User.builder()
            .name(adminName)
            .email(adminEmail)
            .password(passwordEncoder.encode(adminPassword))
            .role(UserRole.ADMIN)
            .active(true)
            .matricula(ADMIN_MATRICULA)
            // mustChangePassword = false para o admin seed — ele já conhece a senha configurada.
            .mustChangePassword(false)
            .build();

        User saved = userRepository.save(admin);

        log.info("Usuário admin criado com sucesso: email={}, matricula={}", adminEmail, ADMIN_MATRICULA);
        log.warn("══════════════════════════════════════════════════════════════");
        log.warn("  ATENÇÃO: Altere a senha do admin em produção via variável");
        log.warn("  de ambiente ADMIN_PASSWORD.");
        log.warn("══════════════════════════════════════════════════════════════");

        return saved;
    }

    /**
     * Cria a célula padrão "C1" e vincula o admin a ela, se ainda não existir.
     *
     * <p>A célula C1 não tem gestor definido no seed (admin tem role ADMIN, não GESTOR).
     * O gestor pode ser atribuído posteriormente via tela de Células.</p>
     *
     * @param admin entidade do administrador para vincular à célula.
     */
    private void createCelulaPadraoIfNotExists(User admin) {
        if (celulaRepository.existsByNome(CELULA_PADRAO_NOME)) {
            log.info("Célula '{}' já existe — seed ignorado.", CELULA_PADRAO_NOME);

            // Garante que o admin está vinculado à célula existente
            if (admin.getCelula() == null) {
                celulaRepository.findAll().stream()
                    .filter(c -> CELULA_PADRAO_NOME.equals(c.getNome()))
                    .findFirst()
                    .ifPresent(celula -> {
                        admin.setCelula(celula);
                        userRepository.save(admin);
                        log.info("Admin vinculado à célula '{}' existente.", CELULA_PADRAO_NOME);
                    });
            }
            return;
        }

        log.info("Criando célula padrão '{}'", CELULA_PADRAO_NOME);

        // Admin tem role ADMIN, não GESTOR — célula criada sem gestor no seed.
        // O gestor deve ser atribuído manualmente via interface após a criação de um GESTOR.
        Celula celulaPadrao = Celula.builder()
            .nome(CELULA_PADRAO_NOME)
            .gestor(null)
            .build();

        Celula savedCelula = celulaRepository.save(celulaPadrao);

        // Vincula o admin à célula C1
        admin.setCelula(savedCelula);
        userRepository.save(admin);

        log.info("Célula '{}' criada e admin vinculado. id={}", CELULA_PADRAO_NOME, savedCelula.getId());
    }
}