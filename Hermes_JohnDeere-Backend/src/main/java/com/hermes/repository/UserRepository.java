package com.hermes.repository;

import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de acesso a dados para a entidade {@link User}.
 *
 * <p>Provê operações de leitura e escrita sobre usuários do sistema HERMES,
 * incluindo autenticação por e-mail (login padrão) e por chave de API
 * (autenticação programática via header {@code X-API-Key}).</p>
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Busca um usuário pelo endereço de e-mail.
     *
     * <p>Utilizado durante o login convencional e pelo {@code UserDetailsService}
     * do Spring Security para carregar o principal autenticado.</p>
     *
     * @param email endereço de e-mail do usuário (case-sensitive conforme coluna no banco)
     * @return {@link Optional} contendo o usuário encontrado, ou vazio se não existir
     */
    Optional<User> findByEmail(String email);

    /**
     * Busca um usuário pela chave de API.
     *
     * <p>Utilizado no filtro de autenticação programática: clientes externos
     * enviam a chave no header {@code X-API-Key} e este método valida a identidade.</p>
     *
     * @param apiKey chave de API gerada e associada ao usuário
     * @return {@link Optional} contendo o usuário correspondente à chave, ou vazio se inválida
     */
    Optional<User> findByApiKey(String apiKey);

    /**
     * Verifica se já existe um usuário cadastrado com o e-mail informado.
     *
     * <p>Usado na criação de novos usuários para garantir unicidade antes de
     * persistir, evitando exceções de constraint no banco de dados.</p>
     *
     * @param email endereço de e-mail a verificar
     * @return {@code true} se o e-mail já estiver em uso, {@code false} caso contrário
     */
    boolean existsByEmail(String email);

    /**
     * Lista usuários ativos filtrados por papel (role), com suporte a paginação.
     *
     * <p>Destinado ao uso administrativo: permite listar apenas usuários do tipo
     * {@code ADMIN} ou {@code USER} que estejam com a conta ativa ({@code isActive = true}).</p>
     *
     * @param role     papel do usuário conforme enum {@link UserRole}
     * @param pageable parâmetros de paginação e ordenação
     * @return página de usuários ativos com o papel informado
     */
    Page<User> findByRoleAndIsActiveTrue(UserRole role, Pageable pageable);

    /**
     * Retorna página de usuários filtrada por papel e situação da conta.
     *
     * @param role     papel a filtrar.
     * @param isActive situação da conta a filtrar.
     * @param pageable configuração de paginação e ordenação.
     * @return página de {@link User}.
     */
    Page<User> findByRoleAndIsActive(UserRole role, boolean isActive, Pageable pageable);
     
     /**
     * Retorna página de usuários filtrada apenas por papel.
     *
     * @param role     papel a filtrar.
     * @param pageable configuração de paginação e ordenação.
     * @return página de {@link User}.
     */
    Page<User> findByRole(UserRole role, Pageable pageable);
     
     /**
     * Retorna página de usuários filtrada apenas por situação da conta.
     *
     * @param isActive situação da conta a filtrar.
     * @param pageable configuração de paginação e ordenação.
     * @return página de {@link User}.
     */
    Page<User> findByIsActive(boolean isActive, Pageable pageable);

    /**
     * Busca um usuário pelo endereço de e-mail.
     *
     * @param email endereço de e-mail.
     * @return {@link Optional} contendo o usuário, ou vazio se não encontrado.
     */
    Optional<User> findByEmail(String email);
}
