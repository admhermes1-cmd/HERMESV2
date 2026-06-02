package com.hermes.repository;

import com.hermes.entity.Celula;
import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de acesso a dados para a entidade {@link User}.
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByApiKey(String apiKey);

    boolean existsByEmail(String email);

    // "IsActive" → "Active" — o campo na entidade se chama "active" (sem prefixo is).
    // Spring Data deriva a query do nome do campo, não do getter.
    Page<User> findByRoleAndActiveTrue(UserRole role, Pageable pageable);

    Page<User> findByRoleAndActive(UserRole role, boolean active, Pageable pageable);

    Page<User> findByRole(UserRole role, Pageable pageable);

    Page<User> findByActive(boolean active, Pageable pageable);

    // ─── Matrícula ────────────────────────────────────────────────────────────

    /**
     * Retorna o maior valor de matrícula existente no banco.
     * Retorna {@link Optional#empty()} quando não há nenhum usuário cadastrado.
     * Usado no service para gerar a próxima matrícula sequencial.
     *
     * @return Optional com o maior valor de matrícula ou vazio.
     */
    @Query("SELECT MAX(u.matricula) FROM User u")
    Optional<Integer> findMaxMatricula();

    // ─── Célula ───────────────────────────────────────────────────────────────

    /**
     * Lista todos os usuários vinculados a uma célula específica.
     *
     * @param celula entidade da célula.
     * @return lista de usuários.
     */
    List<User> findByCelula(Celula celula);

    /**
     * Retorna uma página de usuários filtrados por célula.
     *
     * @param celula   entidade da célula.
     * @param pageable configurações de paginação.
     * @return página de usuários da célula.
     */
    Page<User> findByCelula(Celula celula, Pageable pageable);

    // ─── Role GESTOR — para dropdown de seleção de gestor ────────────────────

    /**
     * Lista todos os usuários ativos com role GESTOR.
     * Usado no frontend para popular o dropdown de seleção de gestor de célula.
     *
     * @return lista de gestores ativos.
     */
    List<User> findByRoleAndActiveTrue(UserRole role);
}
