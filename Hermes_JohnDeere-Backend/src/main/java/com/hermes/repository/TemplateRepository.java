package com.hermes.repository;

import com.hermes.entity.Template;
import com.hermes.entity.enums.TemplateChannel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de acesso a dados para a entidade {@link Template}.
 *
 * <p>Gerencia operações sobre templates de mensagem do HERMES, incluindo
 * listagem paginada com filtros, carregamento eager de versões para evitar
 * N+1 queries, e consultas estatísticas para o dashboard.</p>
 */
@Repository
public interface TemplateRepository extends JpaRepository<Template, UUID> {

    /**
     * Lista templates com paginação e filtro opcional por canal.
     *
     * <p>Quando {@code channel} é {@code null}, todos os canais são retornados.
     * A condição JPQL {@code :channel IS NULL} garante esse comportamento sem
     * necessidade de múltiplas assinaturas de método.</p>
     *
     * @param channel  canal de envio ({@code EMAIL}, {@code SMS}, {@code WHATSAPP});
     *                 pode ser {@code null} para retornar todos os canais
     * @param pageable parâmetros de paginação e ordenação
     * @return página de templates correspondentes ao filtro
     */
    @Query("SELECT t FROM Template t WHERE (:channel IS NULL OR t.channel = :channel)")
    Page<Template> findAllByChannelOptional(
            @Param("channel") TemplateChannel channel,
            Pageable pageable
    );

    /**
     * Busca um template pelo ID com suas versões carregadas em uma única query (JOIN FETCH).
     *
     * <p>Usa {@link EntityGraph} para forçar o carregamento eager da coleção
     * {@code versions}, evitando o problema de N+1 que ocorreria com lazy loading
     * ao iterar as versões fora da transação.</p>
     *
     * @param id identificador único do template
     * @return {@link Optional} contendo o template com versões populadas, ou vazio se não encontrado
     */
    @EntityGraph(attributePaths = {"versions"})
    Optional<Template> findWithVersionsById(UUID id);

    /**
     * Verifica se já existe um template com o nome informado.
     *
     * <p>Utilizado antes da criação de um novo template para garantir unicidade
     * do nome, evitando exceções de constraint no banco de dados.</p>
     *
     * @param name nome do template a verificar
     * @return {@code true} se o nome já estiver em uso, {@code false} caso contrário
     */
    boolean existsByName(String name);

    /**
     * Verifica se existe outro template com o mesmo nome, excluindo o próprio registro.
     *
     * <p>Utilizado na atualização de templates para validar unicidade do nome
     * sem colidir com o próprio template sendo editado.</p>
     *
     * @param name nome do template a verificar
     * @param id   identificador do template a ser excluído da verificação
     * @return {@code true} se outro template já usar este nome, {@code false} caso contrário
     */
    boolean existsByNameAndIdNot(String name, UUID id);

    /**
     * Conta o total de templates cadastrados para um determinado canal.
     *
     * <p>Usado nas estatísticas do dashboard para exibir a distribuição de
     * templates por canal de comunicação.</p>
     *
     * @param channel canal de envio conforme enum {@link TemplateChannel}
     * @return quantidade de templates associados ao canal informado
     */
    long countByChannel(TemplateChannel channel);
}