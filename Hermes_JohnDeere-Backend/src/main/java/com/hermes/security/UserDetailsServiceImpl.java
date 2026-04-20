package com.hermes.security;

import com.hermes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementação de {@link UserDetailsService} responsável por carregar os dados
 * do usuário a partir do banco de dados durante o processo de autenticação do HERMES.
 *
 * <p>Suporta dois mecanismos de identificação:
 * <ul>
 *   <li><b>Email</b> — utilizado pelo {@code DaoAuthenticationProvider} durante o login
 *       interativo via {@code POST /auth/login}.</li>
 *   <li><b>API Key</b> — utilizado pelo {@link JwtAuthFilter} para autenticação
 *       programática via header {@code X-API-Key}.</li>
 * </ul>
 *
 * <p>A entidade {@code User} já implementa {@link UserDetails}, portanto é retornada
 * diretamente sem necessidade de adaptador.
 *
 * <p>Todos os métodos são anotados com {@link Transactional} (somente leitura) para
 * garantir que a sessão do Hibernate permaneça aberta durante o carregamento de
 * associações lazy, caso existam.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    /** Repositório de usuários utilizado para consultas ao banco de dados. */
    private final UserRepository userRepository;

    // -------------------------------------------------------------------------
    // Autenticação por email (fluxo padrão do Spring Security)
    // -------------------------------------------------------------------------

    /**
     * Carrega o usuário pelo endereço de email para autenticação via Spring Security.
     *
     * <p>Invocado automaticamente pelo {@code DaoAuthenticationProvider} durante o
     * processamento de {@code POST /auth/login}. Também pode ser chamado diretamente
     * pelo {@link JwtAuthFilter} ao validar um JWT presente no header {@code Authorization}.
     *
     * @param email endereço de email do usuário (usado como username no contexto do Spring Security)
     * @return instância de {@link UserDetails} correspondente ao usuário encontrado
     * @throws UsernameNotFoundException se nenhum usuário com o email informado existir no banco
     * @throws DisabledException         se o usuário existir mas estiver marcado como inativo
     *                                   ({@code isActive = false})
     */
    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        log.debug("Carregando usuário por email: {}", email);

        com.hermes.entity.User user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    log.warn("Tentativa de autenticação com email não cadastrado: {}", email);
                    return new UsernameNotFoundException("Usuário não encontrado: " + email);
                });

        if (!user.isActive()) {
            log.warn("Tentativa de autenticação de usuário inativo: {}", email);
            throw new DisabledException("Usuário inativo: " + email);
        }

        log.debug("Usuário carregado com sucesso: {} [role={}]", email, user.getRole());
        return user;
    }

    // -------------------------------------------------------------------------
    // Autenticação por API Key (fluxo programático)
    // -------------------------------------------------------------------------

    /**
     * Carrega o usuário pela API Key para autenticação programática.
     *
     * <p>Utilizado pelo {@link JwtAuthFilter} como mecanismo de fallback quando
     * o header {@code Authorization: Bearer} não está presente, mas o header
     * {@code X-API-Key} está. Permite que sistemas externos (outros microsserviços,
     * scripts, etc.) se autentiquem sem precisar de um fluxo de login interativo.
     *
     * <p>Usuários inativos com API Key válida também são bloqueados.
     *
     * @param apiKey chave de API única do usuário, conforme armazenada no banco
     * @return instância de {@link UserDetails} correspondente ao usuário encontrado
     * @throws UsernameNotFoundException se nenhum usuário com a API Key informada existir
     * @throws DisabledException         se o usuário associado à API Key estiver inativo
     */
    @Transactional(readOnly = true)
    public UserDetails loadUserByApiKey(String apiKey) {
        log.debug("Carregando usuário por API Key");

        com.hermes.entity.User user = userRepository.findByApiKey(apiKey)
                .orElseThrow(() -> {
                    log.warn("Tentativa de autenticação com API Key inválida ou não cadastrada");
                    return new UsernameNotFoundException("API Key inválida");
                });

        if (!user.isActive()) {
            log.warn("Tentativa de autenticação via API Key de usuário inativo: {}", user.getEmail());
            throw new DisabledException("Usuário inativo: " + user.getEmail());
        }

        log.debug("Usuário autenticado via API Key: {} [role={}]", user.getEmail(), user.getRole());
        return user;
    }
}