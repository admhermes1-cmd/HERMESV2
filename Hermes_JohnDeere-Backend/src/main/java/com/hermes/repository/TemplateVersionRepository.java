package com.hermes.repository;

import com.hermes.entity.TemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de acesso a dados para a entidade {@link TemplateVersion}.
 *
 * <p>Gerencia as versões de cada template do HERMES, incluindo consultas para
 * determinar a versão mais recente, a versão ativa, e suporte ao controle de
 * versionamento sequencial (auto-incremento do número de versão).</p>
 */
@Repository
public interface TemplateVersionRepository extends JpaRepository<TemplateVersion, UUID> {

    /**
     * Lista todas as versões de um template em ordem decrescente de versão.
     *
     * <p>A mais recente aparece primeiro, facilitando a exibição no histórico
     * de versões sem necessidade de reordenação na camada de serviço.</p>
     *
     * @param templateId identificador do template pai
     * @return lista de versões ordenadas da mais nova para a mais antiga
     */
    List<TemplateVersion> findByTemplateIdOrderByVersionNumberDesc(UUID templateId);

    /**
     * Busca a versão mais recente de um template (maior {@code versionNumber}).
     *
     * <p>Utilizado para apresentar o conteúdo atual do template sem precisar
     * carregar todas as versões e ordenar na memória.</p>
     *
     * @param templateId identificador do template pai
     * @return {@link Optional} contendo a versão com maior número, ou vazio se o template não tiver versões
     */
    @Query("SELECT tv FROM TemplateVersion tv WHERE tv.template.id = :templateId " +
           "ORDER BY tv.versionNumber DESC LIMIT 1")
    Optional<TemplateVersion> findLatestByTemplateId(@Param("templateId") UUID templateId);

    /**
     * Busca a versão atualmente marcada como ativa de um template.
     *
     * <p>Somente a versão ativa ({@code isActive = true}) é utilizada no
     * envio de notificações. Deve existir no máximo uma versão ativa por template.</p>
     *
     * @param templateId identificador do template pai
     * @return {@link Optional} contendo a versão ativa, ou vazio se nenhuma versão estiver ativa
     */
    Optional<TemplateVersion> findByTemplateIdAndActiveTrue(UUID templateId);

    /**
     * Busca uma versão específica de um template pelo número de versão.
     *
     * <p>Utilizado para verificar unicidade antes de persistir uma nova versão
     * e para recuperar versões históricas pelo número exato.</p>
     *
     * @param templateId    identificador do template pai
     * @param versionNumber número da versão a localizar
     * @return {@link Optional} contendo a versão encontrada, ou vazio se não existir
     */
    Optional<TemplateVersion> findByTemplateIdAndVersionNumber(UUID templateId, Integer versionNumber);

    /**
     * Retorna o maior número de versão existente para um template.
     *
     * <p>Utilizado pelo serviço de criação de versões para calcular o próximo
     * número de versão de forma segura ({@code MAX + 1}).
     * Retorna {@code 0} quando o template ainda não possui versões,
     * garantindo que a primeira versão receba o número {@code 1}.</p>
     *
     * @param templateId identificador do template pai
     * @return maior {@code versionNumber} cadastrado, ou {@code 0} se não houver versões
     */
    @Query("SELECT COALESCE(MAX(tv.versionNumber), 0) FROM TemplateVersion tv " +
           "WHERE tv.template.id = :templateId")
    Integer findMaxVersionNumberByTemplateId(@Param("templateId") UUID templateId);

    /**
     * Conta o total de versões cadastradas para um template.
     *
     * <p>Pode ser exibido na listagem de templates como metadado informativo.</p>
     *
     * @param templateId identificador do template pai
     * @return quantidade de versões associadas ao template
     */
    long countByTemplateId(UUID templateId);
}
