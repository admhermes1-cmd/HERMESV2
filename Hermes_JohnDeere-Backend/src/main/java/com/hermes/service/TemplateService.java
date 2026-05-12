package com.hermes.service;

import com.hermes.dto.PageResponseDTO;
import com.hermes.dto.template.TemplateRequestDTO;
import com.hermes.dto.template.TemplateResponseDTO;
import com.hermes.dto.template.TemplateVersionRequestDTO;
import com.hermes.dto.template.TemplateVersionResponseDTO;
import com.hermes.entity.Template;
import com.hermes.entity.TemplateVersion;
import com.hermes.entity.enums.NotificationChannel;
import com.hermes.entity.enums.TemplateChannel;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import com.hermes.repository.NotificationRepository;
import com.hermes.repository.TemplateRepository;
import com.hermes.repository.TemplateVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Serviço de gerenciamento de templates do HERMES.
 *
 * <p>Centraliza todas as operações de ciclo de vida de templates e suas versões:
 * criação, leitura, atualização e exclusão. Garante a integridade das regras de negócio
 * como unicidade de nome, imutabilidade de canal e controle de versões.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateService {

    /** Número máximo de versões permitidas por template. */
    private static final int MAX_VERSIONS_PER_TEMPLATE = 20;

    private final TemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;
    private final NotificationRepository notificationRepository;

    /**
     * Lista templates paginados com filtro opcional de canal.
     *
     * <p>Retorna apenas metadados dos templates, sem carregar as versões,
     * para otimizar performance em listagens grandes.
     *
     * @param channel filtro de canal ({@link TemplateChannel}); {@code null} retorna todos os canais
     * @param page    número da página, 1-based (internamente convertido para 0-based)
     * @param limit   quantidade de itens por página
     * @return página de {@link TemplateResponseDTO} sem versões carregadas
     */
    @Transactional(readOnly = true)
    public PageResponseDTO<TemplateResponseDTO> listTemplates(TemplateChannel channel, int page, int limit) {
        log.debug("Listando templates — canal: {}, página: {}, limite: {}", channel, page, limit);

        Pageable pageable = PageRequest.of(page - 1, limit, Sort.by("name").ascending());
        Page<Template> result = templateRepository.findAllByChannelOptional(channel, pageable);

        return PageResponseDTO.from(result.map(TemplateResponseDTO::fromWithoutVersions), page, limit);
    }

    /**
     * Busca um template por ID, incluindo todas as suas versões.
     *
     * @param id UUID do template
     * @return {@link TemplateResponseDTO} com versões carregadas
     * @throws AppException {@code TEMPLATE_NOT_FOUND} se o template não existir
     */
    @Transactional(readOnly = true)
    public TemplateResponseDTO getTemplate(UUID id) {
        log.debug("Buscando template: {}", id);

        Template template = templateRepository.findWithVersionsById(id)
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND,
                        "Template não encontrado: " + id));

        return TemplateResponseDTO.from(template);
    }

    /**
     * Cria um novo template com sua primeira versão gerada automaticamente.
     *
     * <p>A primeira versão é criada com {@code versionNumber = 1} e {@code isActive = true}.
     * O canal definido na criação é imutável e não poderá ser alterado posteriormente.
     *
     * @param request   dados do novo template
     * @param createdBy UUID do usuário criador
     * @return {@link TemplateResponseDTO} com a versão inicial incluída
     * @throws AppException {@code TEMPLATE_NAME_DUPLICATE} se já existir um template com o mesmo nome
     */
    @Transactional
    public TemplateResponseDTO createTemplate(TemplateRequestDTO request, UUID createdBy) {
        log.debug("Criando template '{}' para o canal {} por {}", request.getName(), request.getChannel(), createdBy);

        if (templateRepository.existsByName(request.getName())) {
            throw AppException.conflict(ErrorCode.TEMPLATE_NAME_DUPLICATE,
                    "Já existe um template com o nome: " + request.getName());
        }

        Template template = Template.builder()
                .name(request.getName())
                .description(request.getDescription())
                .channel(NotificationChannel.valueOf(request.getChannel().name()))
                .createdBy(createdBy)
                .build();

        if (request.getVersion() != null) {
            TemplateVersion firstVersion = TemplateVersion.builder()
                    .template(template)
                    .versionNumber(1)
                    .subject(request.getVersion().getSubject())
                    .body(request.getVersion().getBody())
                    .variables(request.getVersion().getVariables())
                    .active(true)
                    .createdAt(LocalDateTime.now())
                    .build();

            template.getVersions().add(firstVersion);
        }

        Template saved = templateRepository.save(template);

        log.info("Template criado: {} por {}", saved.getId(), createdBy);
        return TemplateResponseDTO.from(saved);
    }

    /**
     * Atualiza os metadados de um template existente (nome e descrição).
     *
     * <p><strong>Restrição:</strong> o canal ({@link TemplateChannel}) é imutável após a criação
     * e não pode ser alterado por este método. As versões não são afetadas.
     *
     * @param id      UUID do template a atualizar
     * @param request dados atualizados do template
     * @return {@link TemplateResponseDTO} com os dados atualizados e versões carregadas
     * @throws AppException {@code TEMPLATE_NOT_FOUND}      se o template não existir
     * @throws AppException {@code TEMPLATE_NAME_DUPLICATE} se o novo nome já estiver em uso por outro template
     */
    @Transactional
    public TemplateResponseDTO updateTemplate(UUID id, TemplateRequestDTO request) {
        log.debug("Atualizando template: {}", id);

        Template template = templateRepository.findWithVersionsById(id)
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND,
                        "Template não encontrado: " + id));

        boolean nameChanged = !template.getName().equals(request.getName());
        if (nameChanged && templateRepository.existsByNameAndIdNot(request.getName(), id)) {
            throw AppException.conflict(ErrorCode.TEMPLATE_NAME_DUPLICATE,
                    "Já existe outro template com o nome: " + request.getName());
        }

        template.setName(request.getName());
        template.setDescription(request.getDescription());

        Template saved = templateRepository.save(template);

        log.info("Template atualizado: {}", saved.getId());
        return TemplateResponseDTO.from(saved);
    }

    /**
     * Exclui um template e todas as suas versões em cascata.
     *
     * <p>A exclusão é bloqueada se houver notificações vinculadas ao template,
     * garantindo a rastreabilidade histórica das comunicações enviadas.
     *
     * @param id UUID do template a excluir
     * @throws AppException {@code TEMPLATE_NOT_FOUND}         se o template não existir
     * @throws AppException {@code TEMPLATE_HAS_NOTIFICATIONS} se existirem notificações vinculadas ao template
     */
    @Transactional
    public void deleteTemplate(UUID id) {
        log.debug("Solicitação de exclusão do template: {}", id);

        Template template = templateRepository.findById(id)
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND,
                        "Template não encontrado: " + id));

        boolean hasNotifications = !notificationRepository.findByTemplateId(id).isEmpty();
        if (hasNotifications) {
            throw AppException.conflict(ErrorCode.TEMPLATE_HAS_NOTIFICATIONS,
                    "Não é possível excluir o template pois existem notificações vinculadas a ele.");
        }

        templateRepository.delete(template);
        log.info("Template excluído: {}", id);
    }

    /**
     * Lista todas as versões de um template, ordenadas da mais recente para a mais antiga.
     *
     * @param templateId UUID do template pai
     * @return lista de {@link TemplateVersionResponseDTO} ordenada decrescentemente por {@code versionNumber}
     * @throws AppException {@code TEMPLATE_NOT_FOUND} se o template não existir
     */
    @Transactional(readOnly = true)
    public List<TemplateVersionResponseDTO> listVersions(UUID templateId) {
        log.debug("Listando versões do template: {}", templateId);

        if (!templateRepository.existsById(templateId)) {
            throw AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND,
                    "Template não encontrado: " + templateId);
        }

        return templateVersionRepository
                .findByTemplateIdOrderByVersionNumberDesc(templateId)
                .stream()
                .map(TemplateVersionResponseDTO::from)
                .toList();
    }

    /**
     * Cria uma nova versão para o template informado.
     *
     * <p>O {@code versionNumber} é calculado automaticamente como {@code MAX(versões existentes) + 1}.
     * Se não houver versões anteriores, começa em 1.
     *
     * @param templateId UUID do template pai
     * @param request    dados da nova versão
     * @return {@link TemplateVersionResponseDTO} da versão recém-criada
     * @throws AppException {@code TEMPLATE_NOT_FOUND}    se o template não existir
     * @throws AppException {@code TEMPLATE_MAX_VERSIONS} se o limite de versões por template for atingido
     */
    @Transactional
    public TemplateVersionResponseDTO createVersion(UUID templateId, TemplateVersionRequestDTO request) {
        log.debug("Criando nova versão para o template: {}", templateId);

        Template template = templateRepository.findById(templateId)
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND,
                        "Template não encontrado: " + templateId));

        int currentMax = templateVersionRepository.findMaxVersionNumberByTemplateId(templateId);

        if (currentMax >= MAX_VERSIONS_PER_TEMPLATE) {
            throw AppException.badRequest(ErrorCode.TEMPLATE_MAX_VERSIONS,
                    "O template atingiu o limite máximo de " + MAX_VERSIONS_PER_TEMPLATE + " versões.");
        }

        int newVersionNumber = currentMax + 1;

        TemplateVersion version = TemplateVersion.builder()
                .template(template)
                .versionNumber(newVersionNumber)
                .subject(request.getSubject())
                .body(request.getBody())
                .variables(request.getVariables())
                .active(true)
                .createdAt(LocalDateTime.now())
                .build();

        TemplateVersion saved = templateVersionRepository.save(version);

        log.info("Versão {} criada para o template: {}", newVersionNumber, templateId);
        return TemplateVersionResponseDTO.from(saved);
    }

    /**
     * Atualiza o conteúdo de uma versão específica de um template.
     *
     * @param templateId UUID do template pai
     * @param versionId  UUID da versão a atualizar
     * @param request    dados atualizados da versão
     * @return {@link TemplateVersionResponseDTO} com os dados atualizados
     * @throws AppException {@code TEMPLATE_NOT_FOUND}         se o template não existir
     * @throws AppException {@code TEMPLATE_VERSION_NOT_FOUND} se a versão não existir ou não pertencer ao template
     */
    @Transactional
    public TemplateVersionResponseDTO updateVersion(UUID templateId, UUID versionId,
                                                     TemplateVersionRequestDTO request) {
        log.debug("Atualizando versão {} do template: {}", versionId, templateId);

        if (!templateRepository.existsById(templateId)) {
            throw AppException.notFound(ErrorCode.TEMPLATE_NOT_FOUND,
                    "Template não encontrado: " + templateId);
        }

        TemplateVersion version = templateVersionRepository
                .findById(versionId)
                .filter(v -> v.getTemplate().getId().equals(templateId))
                .orElseThrow(() -> AppException.notFound(ErrorCode.TEMPLATE_VERSION_NOT_FOUND,
                        "Versão não encontrada: " + versionId + " no template: " + templateId));

        version.setSubject(request.getSubject());
        version.setBody(request.getBody());
        version.setVariables(request.getVariables());

        TemplateVersion saved = templateVersionRepository.save(version);

        log.info("Versão {} do template {} atualizada", versionId, templateId);
        return TemplateVersionResponseDTO.from(saved);
    }
}
