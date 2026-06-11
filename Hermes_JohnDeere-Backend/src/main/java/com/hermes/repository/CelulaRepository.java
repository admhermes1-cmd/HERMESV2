package com.hermes.repository;

import com.hermes.entity.Celula;
import com.hermes.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de acesso a dados para a entidade {@link Celula}.
 */
@Repository
public interface CelulaRepository extends JpaRepository<Celula, UUID> {

    /**
     * Verifica se já existe uma célula com o nome informado.
     *
     * @param nome nome a verificar.
     * @return {@code true} se já existir uma célula com este nome.
     */
    boolean existsByNome(String nome);

    /**
     * Verifica se já existe uma célula com o nome informado, excluindo um id específico.
     * Usado na edição para não bloquear a própria célula.
     *
     * @param nome nome a verificar.
     * @param id   id da célula a excluir da verificação.
     * @return {@code true} se o nome já estiver em uso por outra célula.
     */
    boolean existsByNomeAndIdNot(String nome, UUID id);

    /**
     * Retorna uma página de células com contagem de usuários via JOIN.
     * Usa LEFT JOIN para incluir células sem usuários (contagem zero).
     *
     * @param pageable configurações de paginação e ordenação.
     * @return página de células.
     */
    @Query("SELECT c FROM Celula c LEFT JOIN FETCH c.gestor ORDER BY c.nome ASC")
    Page<Celula> findAllWithGestor(Pageable pageable);

    /**
     * Busca uma célula pelo id com gestor e lista de usuários carregados.
     * Necessário para o endpoint de detalhe que exibe todos os usuários.
     *
     * @param id identificador da célula.
     * @return Optional com a célula ou vazio se não encontrada.
     */
    @Query("SELECT c FROM Celula c LEFT JOIN FETCH c.gestor LEFT JOIN FETCH c.usuarios WHERE c.id = :id")
    Optional<Celula> findByIdWithUsuarios(UUID id);

    /**
     * Busca a célula pelo gestor. Útil para verificação de gestor já atribuído.
     *
     * @param gestor entidade do usuário gestor.
     * @return Optional com a célula gerenciada pelo usuário informado.
     */
    Optional<Celula> findByGestor(User gestor);
}