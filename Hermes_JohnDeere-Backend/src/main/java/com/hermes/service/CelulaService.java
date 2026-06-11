package com.hermes.service;

import com.hermes.dto.celula.CelulaDetalheDTO;
import com.hermes.dto.celula.CelulaRequestDTO;
import com.hermes.dto.celula.CelulaResponseDTO;
import com.hermes.dto.user.UserListResponseDTO;
import com.hermes.dto.PageResponseDTO;
import com.hermes.entity.Celula;
import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import com.hermes.exception.AppException;
import com.hermes.repository.CelulaRepository;
import com.hermes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Serviço responsável pelo ciclo de vida de células organizacionais no sistema HERMES.
 *
 * <p>Implementa as seguintes regras de negócio:</p>
 * <ul>
 *   <li>Nome da célula deve ser único no sistema.</li>
 *   <li>Gestor é opcional — uma célula pode existir sem ninguém vinculado.
 *       Quando informado, o usuário deve ter {@code role = GESTOR} e não pode
 *       já gerenciar outra célula.</li>
 *   <li>Um GESTOR só pode editar (PUT) a própria célula, e não pode trocar o gestor
 *       da célula — apenas ADMIN pode reatribuir o gestor.</li>
 *   <li>Ao excluir uma célula, o campo {@code celula} dos usuários vinculados é zerado;
 *       a exclusão não é bloqueada pela existência de usuários vinculados.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CelulaService {

    private final CelulaRepository celulaRepository;
    private final UserRepository userRepository;

    // =========================================================================
    // Consultas
    // =========================================================================

    /**
     * Retorna uma página de células com dados resumidos do gestor e contagem de usuários.
     *
     * @param page  índice da página (1-based, convertido internamente para 0-based).
     * @param limit número de itens por página.
     * @return página de {@link CelulaResponseDTO}.
     */
    @Transactional(readOnly = true)
    public PageResponseDTO<CelulaResponseDTO> listCelulas(int page, int limit) {
        Pageable pageable = PageRequest.of(page - 1, limit, Sort.by("nome").ascending());
        Page<Celula> celulaPage = celulaRepository.findAllWithGestor(pageable);

        List<CelulaResponseDTO> dtos = celulaPage.getContent()
                .stream()
                .map(c -> CelulaResponseDTO.from(c, userRepository.countByCelula(c)))
                .toList();

        return PageResponseDTO.from(celulaPage, dtos, page, limit);
    }

    /**
     * Retorna os detalhes completos de uma célula, incluindo a lista de usuários vinculados.
     *
     * @param id identificador da célula.
     * @return {@link CelulaDetalheDTO} com todos os campos e lista de usuários.
     * @throws AppException {@code CELULA_NOT_FOUND} se não existir célula com o id informado.
     */
    @Transactional(readOnly = true)
    public CelulaDetalheDTO findById(UUID id) {
        Celula celula = celulaRepository.findByIdWithUsuarios(id)
                .orElseThrow(AppException::celulaNotFound);

        return CelulaDetalheDTO.from(celula);
    }

    /**
     * Lista os usuários vinculados a uma célula específica.
     *
     * @param id identificador da célula.
     * @return lista de {@link UserListResponseDTO} dos usuários da célula.
     * @throws AppException {@code CELULA_NOT_FOUND} se não existir célula com o id informado.
     */
    @Transactional(readOnly = true)
    public List<UserListResponseDTO> listUsuariosByCelula(UUID id) {
        Celula celula = findCelulaOrThrow(id);

        return userRepository.findByCelula(celula)
                .stream()
                .map(UserListResponseDTO::from)
                .toList();
    }

    // =========================================================================
    // Criação
    // =========================================================================

    /**
     * Cria uma nova célula no sistema.
     *
     * <p>Endpoint restrito a ADMIN — qualquer gestor informado pode ser livremente
     * atribuído.</p>
     *
     * @param dto dados da nova célula.
     * @return {@link CelulaResponseDTO} da célula criada.
     * @throws AppException {@code CELULA_NOME_DUPLICATE}         se o nome já estiver em uso.
     * @throws AppException {@code CELULA_GESTOR_INVALID_ROLE}    se o gestor não tiver role GESTOR.
     * @throws AppException {@code CELULA_GESTOR_ALREADY_ASSIGNED} se o gestor já gerenciar outra célula.
     * @throws AppException {@code USER_NOT_FOUND}                se o gestor informado não existir.
     */
    @Transactional
    public CelulaResponseDTO createCelula(CelulaRequestDTO dto) {
        validateNomeUnique(dto.nome(), null);

        User gestor = resolveGestor(dto.gestorId(), null);

        Celula celula = Celula.builder()
                .nome(dto.nome().trim())
                .gestor(gestor)
                .build();

        Celula saved = celulaRepository.save(celula);
        log.info("Célula criada: id={}, nome={}", saved.getId(), saved.getNome());

        return CelulaResponseDTO.from(saved, 0);
    }

    // =========================================================================
    // Edição
    // =========================================================================

    /**
     * Atualiza os dados de uma célula existente.
     *
     * <p>ADMIN pode editar qualquer célula e reatribuir o gestor livremente.
     * GESTOR só pode editar a própria célula (a que ele gerencia) e não pode
     * alterar o gestor — o valor de {@code dto.gestorId()} é ignorado nesse caso.</p>
     *
     * @param id        identificador da célula a ser atualizada.
     * @param dto       dados novos.
     * @param requester usuário autenticado que está realizando a operação.
     * @return {@link CelulaResponseDTO} atualizado.
     * @throws AppException {@code CELULA_NOT_FOUND}              se não existir célula com o id.
     * @throws AppException {@code CELULA_NOME_DUPLICATE}         se o novo nome já estiver em uso por outra célula.
     * @throws AppException {@code CELULA_GESTOR_INVALID_ROLE}    se o novo gestor não tiver role GESTOR.
     * @throws AppException {@code CELULA_GESTOR_ALREADY_ASSIGNED} se o novo gestor já gerenciar outra célula.
     * @throws AppException {@code USER_NOT_FOUND}                se o gestor informado não existir.
     * @throws AppException {@code CELULA_NOT_OWNED_BY_GESTOR}    se um GESTOR tentar editar uma célula que não é a sua.
     */
    @Transactional
    public CelulaResponseDTO updateCelula(UUID id, CelulaRequestDTO dto, User requester) {
        Celula celula = findCelulaOrThrow(id);

        validateNomeUnique(dto.nome(), id);

        celula.setNome(dto.nome().trim());

        if (requester != null && requester.getRole() == UserRole.GESTOR) {
            // GESTOR só pode editar a própria célula e não pode trocar o gestor.
            boolean isOwnCelula = celula.getGestor() != null
                    && celula.getGestor().getId().equals(requester.getId());

            if (!isOwnCelula) {
                throw AppException.celulaNotOwnedByGestor();
            }
        } else {
            User gestor = resolveGestor(dto.gestorId(), id);
            celula.setGestor(gestor);
        }

        Celula saved = celulaRepository.save(celula);
        log.info("Célula atualizada: id={}, nome={}", saved.getId(), saved.getNome());

        return CelulaResponseDTO.from(saved, userRepository.countByCelula(saved));
    }

    // =========================================================================
    // Exclusão
    // =========================================================================

    /**
     * Remove uma célula do sistema.
     *
     * <p>Os usuários vinculados a esta célula terão o campo {@code celula} zerado
     * (SET NULL) antes da exclusão. A exclusão nunca é bloqueada pela existência
     * de usuários na célula.</p>
     *
     * @param id identificador da célula a ser removida.
     * @throws AppException {@code CELULA_NOT_FOUND} se não existir célula com o id informado.
     */
    @Transactional
    public void deleteCelula(UUID id) {
        Celula celula = findCelulaOrThrow(id);

        // Zerar o campo celula em todos os usuários vinculados antes de excluir.
        // Garante integridade referencial mesmo sem ON DELETE SET NULL no DDL.
        List<User> usuariosVinculados = userRepository.findByCelula(celula);
        for (User u : usuariosVinculados) {
            u.setCelula(null);
            userRepository.save(u);
        }

        celulaRepository.delete(celula);
        log.info("Célula removida: id={}", id);
    }

    // =========================================================================
    // Auxiliares privados
    // =========================================================================

    /**
     * Busca uma célula pelo id ou lança {@code CELULA_NOT_FOUND}.
     *
     * @param id identificador da célula.
     * @return entidade {@link Celula}.
     */
    private Celula findCelulaOrThrow(UUID id) {
        return celulaRepository.findById(id)
                .orElseThrow(AppException::celulaNotFound);
    }

    /**
     * Valida unicidade do nome da célula.
     * Em edição, exclui o próprio id da verificação para não bloquear o save.
     *
     * @param nome       nome a validar.
     * @param excludedId id a excluir da verificação (null em criação).
     */
    private void validateNomeUnique(String nome, UUID excludedId) {
        boolean duplicado = excludedId != null
                ? celulaRepository.existsByNomeAndIdNot(nome.trim(), excludedId)
                : celulaRepository.existsByNome(nome.trim());

        if (duplicado) {
            throw AppException.celulaNomeDuplicate();
        }
    }

    /**
     * Resolve o usuário gestor pelo id, se informado, validando role e exclusividade.
     *
     * <p>Gestor é opcional — uma célula pode ser criada/mantida sem gestor atribuído.
     * Quando informado, o usuário deve ter {@code role = GESTOR} e não pode já
     * gerenciar outra célula (exceto a própria célula sendo editada).</p>
     *
     * @param gestorId       UUID do usuário gestor; pode ser {@code null}.
     * @param excludedCelulaId id da célula sendo editada, excluído da verificação de
     *                       exclusividade ({@code null} em criação).
     * @return entidade {@link User} com role GESTOR, ou {@code null} se {@code gestorId} for {@code null}.
     * @throws AppException {@code USER_NOT_FOUND}                se não encontrado.
     * @throws AppException {@code CELULA_GESTOR_INVALID_ROLE}    se não tiver role GESTOR.
     * @throws AppException {@code CELULA_GESTOR_ALREADY_ASSIGNED} se já gerenciar outra célula.
     */
    private User resolveGestor(UUID gestorId, UUID excludedCelulaId) {
        if (gestorId == null) {
            return null;
        }

        User gestor = userRepository.findById(gestorId)
                .orElseThrow(AppException::userNotFound);

        if (gestor.getRole() != UserRole.GESTOR) {
            throw AppException.celulaGestorInvalidRole();
        }

        celulaRepository.findByGestor(gestor).ifPresent(existing -> {
            if (excludedCelulaId == null || !existing.getId().equals(excludedCelulaId)) {
                throw AppException.celulaGestorAlreadyAssigned();
            }
        });

        return gestor;
    }
}
