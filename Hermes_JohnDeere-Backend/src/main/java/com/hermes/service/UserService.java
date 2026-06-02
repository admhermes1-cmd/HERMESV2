package com.hermes.service;

import com.hermes.dto.user.UserListResponseDTO;
import com.hermes.dto.user.UserRequestDTO;
import com.hermes.dto.user.UserResponseDTO;
import com.hermes.exception.AppException;
import com.hermes.entity.Celula;
import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import com.hermes.repository.CelulaRepository;
import com.hermes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.UUID;

/**
 * Serviço responsável por todo o ciclo de vida de usuários no sistema HERMES.
 *
 * <p>Implementa as seguintes regras de negócio:</p>
 * <ul>
 *   <li>Criação com senha aleatória gerada pelo backend e enviada por e-mail.</li>
 *   <li>Matrícula gerada automaticamente no {@code @PrePersist}: MAX atual + 1, inicial 10000.</li>
 *   <li>E-mail imutável após a criação.</li>
 *   <li>Redefinição de senha gera nova senha aleatória e reenvia por e-mail.</li>
 *   <li>Um administrador não pode excluir a própria conta.</li>
 *   <li>Um GESTOR não pode criar, editar ou excluir usuários com role ADMIN ou GESTOR.</li>
 *   <li>Célula obrigatória na criação de usuários.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private static final String PASSWORD_CHARS =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int PASSWORD_LENGTH = 8;

    /** Valor da primeira matrícula quando o banco não tem nenhum usuário. */
    private static final int MATRICULA_INICIAL = 10000;

    private final UserRepository userRepository;
    private final CelulaRepository celulaRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final PasswordValidationService passwordValidationService;

    // =========================================================================
    // Consultas
    // =========================================================================

    /**
     * Retorna uma página de usuários com filtros opcionais.
     *
     * @param page     índice da página (0-based).
     * @param limit    número de itens por página.
     * @param role     filtro opcional por {@link UserRole}; {@code null} ignora o filtro.
     * @param isActive filtro opcional por situação da conta; {@code null} ignora o filtro.
     * @return página de {@link UserListResponseDTO}.
     */
    @Transactional(readOnly = true)
    public Page<UserListResponseDTO> listUsers(int page, int limit, UserRole role, Boolean isActive) {
        Pageable pageable = PageRequest.of(page, limit, Sort.by("createdAt").descending());

        Page<User> users;

        if (role != null && isActive != null) {
            users = userRepository.findByRoleAndActive(role, isActive, pageable);
        } else if (role != null) {
            users = userRepository.findByRole(role, pageable);
        } else if (isActive != null) {
            users = userRepository.findByActive(isActive, pageable);
        } else {
            users = userRepository.findAll(pageable);
        }

        return users.map(UserListResponseDTO::from);
    }

    /**
     * Retorna um usuário pelo seu identificador.
     *
     * @param id identificador do usuário.
     * @return {@link UserResponseDTO} com todos os campos públicos, incluindo {@code apiKey}.
     * @throws AppException {@code USER_NOT_FOUND} se não existir usuário com o id informado.
     */
    @Transactional(readOnly = true)
    public UserResponseDTO findById(UUID id) {
        User user = findUserOrThrow(id);
        return UserResponseDTO.from(user);
    }

    // =========================================================================
    // Criação
    // =========================================================================

    /**
     * Cria um novo usuário no sistema.
     *
     * <p>A senha é gerada aleatoriamente pelo backend e enviada por e-mail ao
     * endereço informado no DTO. A matrícula é gerada automaticamente (MAX + 1).
     * A célula é obrigatória e validada antes do save.</p>
     *
     * @param dto       dados do novo usuário.
     * @param requester usuário autenticado que está realizando a operação (para validação de role).
     * @return {@link UserResponseDTO} do usuário criado.
     * @throws AppException {@code USER_EMAIL_DUPLICATE}      se o e-mail já estiver em uso.
     * @throws AppException {@code USER_CELULA_REQUIRED}      se a célula não for informada.
     * @throws AppException {@code CELULA_NOT_FOUND}          se a célula informada não existir.
     * @throws AppException {@code GESTOR_CANNOT_EDIT_ADMIN}  se um GESTOR tentar criar ADMIN/GESTOR.
     */
    @Transactional
    public UserResponseDTO createUser(UserRequestDTO dto, User requester) {
        validateRoleTarget(dto.role(), requester);
        validateEmailUnique(dto.email());

        Celula celula = resolveCelula(dto.celulaId());

        String rawPassword = generateRandomPassword();
        int matricula      = generateNextMatricula();

        User user = new User();
        user.setName(dto.name());
        user.setEmail(dto.email());
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(dto.role() != null ? dto.role() : UserRole.USER);
        user.setActive(dto.isActive() != null ? dto.isActive() : true);
        user.setMatricula(matricula);
        user.setCargo(dto.cargo());
        user.setCelula(celula);

        User saved = userRepository.save(user);
        log.info("Usuário criado: id={}, email={}, matricula={}", saved.getId(), saved.getEmail(), saved.getMatricula());

        sendWelcomeEmailSafely(saved, rawPassword);

        return UserResponseDTO.from(saved);
    }

    // =========================================================================
    // Edição
    // =========================================================================

    /**
     * Atualiza os dados editáveis de um usuário existente.
     *
     * <p>O campo {@code email} é ignorado nesta operação — o e-mail é imutável.
     * A matrícula também é imutável.</p>
     *
     * @param id        identificador do usuário a ser atualizado.
     * @param dto       dados novos.
     * @param requester usuário autenticado que está realizando a operação.
     * @return {@link UserResponseDTO} atualizado.
     * @throws AppException {@code USER_NOT_FOUND}            se não existir usuário com o id.
     * @throws AppException {@code GESTOR_CANNOT_EDIT_ADMIN}  se um GESTOR tentar editar ADMIN/GESTOR.
     */
    @Transactional
    public UserResponseDTO updateUser(UUID id, UserRequestDTO dto, User requester) {
        User user = findUserOrThrow(id);

        // Valida role do alvo ATUAL (usuário a ser editado)
        validateRoleTarget(user.getRole(), requester);
        // Valida também o role DESTINO (para onde o usuário seria movido)
        if (dto.role() != null) {
            validateRoleTarget(dto.role(), requester);
        }

        user.setName(dto.name());
        if (dto.role() != null) {
            user.setRole(dto.role());
        }
        if (dto.isActive() != null) {
            user.setActive(dto.isActive());
        }
        if (dto.cargo() != null) {
            user.setCargo(dto.cargo());
        }
        if (dto.celulaId() != null) {
            Celula celula = celulaRepository.findById(dto.celulaId())
                    .orElseThrow(AppException::celulaNotFound);
            user.setCelula(celula);
        }

        User saved = userRepository.save(user);
        log.info("Usuário atualizado: id={}", saved.getId());

        return UserResponseDTO.from(saved);
    }

    // =========================================================================
    // Troca de senha
    // =========================================================================

    /**
     * Troca a senha do usuário autenticado, aplicando todas as regras de complexidade.
     *
     * <p>Ao concluir com sucesso, seta {@code mustChangePassword = false},
     * liberando o usuário para navegar normalmente pelo sistema.</p>
     *
     * @param currentPassword senha atual em texto puro — para verificação.
     * @param newPassword     nova senha em texto puro — deve cumprir política de senhas.
     * @throws AppException {@code PASSWORD_CURRENT_INCORRECT} se a senha atual estiver errada.
     * @throws AppException {@code PASSWORD_POLICY_VIOLATION}  se a nova senha violar alguma regra.
     */
    @Transactional
    public void changePassword(String currentPassword, String newPassword) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(AppException::userNotFound);

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw AppException.passwordCurrentIncorrect();
        }

        passwordValidationService.validate(newPassword, user, currentPassword);

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);

        userRepository.save(user);

        log.info("Senha alterada com sucesso para o usuário: id={}", user.getId());
    }

    // =========================================================================
    // Redefinição de senha
    // =========================================================================

    /**
     * Gera uma nova senha aleatória para o usuário e a envia por e-mail.
     *
     * @param id identificador do usuário.
     * @throws AppException {@code USER_NOT_FOUND} se não existir usuário com o id informado.
     */
    @Transactional
    public void resetPassword(UUID id) {
        User user = findUserOrThrow(id);

        String rawPassword = generateRandomPassword();

        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setMustChangePassword(true);

        userRepository.save(user);

        log.info("Senha redefinida para o usuário: id={}", user.getId());

        sendWelcomeEmailSafely(user, rawPassword);
    }

    // =========================================================================
    // Exclusão
    // =========================================================================

    /**
     * Remove um usuário do sistema.
     *
     * <p>Um administrador não pode excluir a própria conta.
     * Um GESTOR não pode excluir usuários com role ADMIN ou GESTOR.</p>
     *
     * @param id        identificador do usuário a ser removido.
     * @param requester usuário autenticado que está realizando a operação.
     * @throws AppException {@code USER_NOT_FOUND}            se não existir usuário com o id.
     * @throws AppException {@code USER_CANNOT_DELETE_SELF}   se o admin tentar excluir a própria conta.
     * @throws AppException {@code GESTOR_CANNOT_EDIT_ADMIN}  se um GESTOR tentar excluir ADMIN/GESTOR.
     */
    @Transactional
    public void deleteUser(UUID id, User requester) {
        User user = findUserOrThrow(id);

        String currentUserEmail = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();

        if (user.getEmail().equals(currentUserEmail)) {
            throw AppException.userCannotDeleteSelf();
        }

        validateRoleTarget(user.getRole(), requester);

        userRepository.delete(user);
        log.info("Usuário removido: id={}", id);
    }

    // =========================================================================
    // Auxiliares privados
    // =========================================================================

    /**
     * Busca um usuário pelo id ou lança {@code USER_NOT_FOUND}.
     *
     * @param id identificador do usuário.
     * @return entidade {@link User}.
     */
    private User findUserOrThrow(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(AppException::userNotFound);
    }

    /**
     * Valida que o e-mail informado não está em uso por outro usuário.
     *
     * @param email e-mail a verificar.
     */
    private void validateEmailUnique(String email) {
        if (userRepository.existsByEmail(email)) {
            throw AppException.userEmailDuplicate();
        }
    }

    /**
     * Valida se o requester tem permissão para operar sobre um usuário com o role alvo.
     *
     * <p>Regra: GESTOR não pode criar, editar ou excluir usuários com role ADMIN ou GESTOR.
     * ADMIN não tem restrições.</p>
     *
     * @param targetRole role do usuário alvo da operação.
     * @param requester  usuário autenticado realizando a operação.
     */
    private void validateRoleTarget(UserRole targetRole, User requester) {
        if (requester == null) return;
        if (requester.getRole() == UserRole.ADMIN) return;

        // GESTOR não pode operar sobre ADMIN ou GESTOR
        if (requester.getRole() == UserRole.GESTOR
                && (targetRole == UserRole.ADMIN || targetRole == UserRole.GESTOR)) {
            throw AppException.gestorCannotEditAdmin();
        }
    }

    /**
     * Resolve a célula pelo id, ou lança exceção apropriada.
     * Se {@code celulaId} for {@code null}, lança {@code USER_CELULA_REQUIRED}.
     *
     * @param celulaId UUID da célula; pode ser {@code null}.
     * @return entidade {@link Celula} encontrada.
     */
    private Celula resolveCelula(UUID celulaId) {
        if (celulaId == null) {
            throw AppException.userCelulaRequired();
        }
        return celulaRepository.findById(celulaId)
                .orElseThrow(AppException::celulaNotFound);
    }

    /**
     * Gera o próximo número de matrícula sequencial.
     *
     * <p>Busca o MAX atual no banco e incrementa. Se não houver nenhum usuário,
     * retorna {@link #MATRICULA_INICIAL} (10000).</p>
     *
     * @return próxima matrícula disponível.
     */
    private int generateNextMatricula() {
        return userRepository.findMaxMatricula()
                .map(max -> max + 1)
                .orElse(MATRICULA_INICIAL);
    }

    /**
     * Gera uma senha aleatória com {@link #PASSWORD_LENGTH} caracteres
     * a partir de {@link #PASSWORD_CHARS}.
     *
     * @return senha em texto puro.
     */
    private String generateRandomPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(PASSWORD_LENGTH);

        for (int i = 0; i < PASSWORD_LENGTH; i++) {
            sb.append(PASSWORD_CHARS.charAt(random.nextInt(PASSWORD_CHARS.length())));
        }

        return sb.toString();
    }

    /**
     * Envia o e-mail de boas-vindas sem propagar falhas de envio.
     * Falhas de e-mail são logadas mas não interrompem o fluxo de criação do usuário.
     *
     * @param user        usuário recém-criado.
     * @param rawPassword senha em texto puro para envio.
     */
    private void sendWelcomeEmailSafely(User user, String rawPassword) {
        try {
            emailService.sendWelcomeEmail(user.getEmail(), user.getName(), rawPassword);
        } catch (Exception e) {
            log.error(
                "HERMES-EMAIL-DEBUG | tipo={} | msg={} | causa={} | stacktrace=",
                e.getClass().getName(),
                e.getMessage(),
                e.getCause() != null ? e.getCause().getMessage() : "nenhuma",
                e
            );
        }
    }
}
