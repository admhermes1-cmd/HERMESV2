package com.hermes.service;

import com.hermes.dto.user.UserListResponseDTO;
import com.hermes.dto.user.UserRequestDTO;
import com.hermes.dto.user.UserResponseDTO;
import com.hermes.exception.AppException;
import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
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
 *   <li>E-mail imutável após a criação.</li>
 *   <li>Redefinição de senha gera nova senha aleatória e reenvia por e-mail.</li>
 *   <li>Um administrador não pode excluir a própria conta.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private static final String PASSWORD_CHARS =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int PASSWORD_LENGTH = 8;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    // -------------------------------------------------------------------------
    // Consultas
    // -------------------------------------------------------------------------

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
            users = userRepository.findByRoleAndIsActive(role, isActive, pageable);
        } else if (role != null) {
            users = userRepository.findByRole(role, pageable);
        } else if (isActive != null) {
            users = userRepository.findByIsActive(isActive, pageable);
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

    // -------------------------------------------------------------------------
    // Criação
    // -------------------------------------------------------------------------

    /**
     * Cria um novo usuário no sistema.
     *
     * <p>A senha é gerada aleatoriamente pelo backend e enviada por e-mail ao
     * endereço informado no DTO. O campo {@code isActive} é opcionalmente recebido;
     * caso omitido, o padrão é {@code true}.</p>
     *
     * @param dto dados do novo usuário.
     * @return {@link UserResponseDTO} do usuário criado.
     * @throws AppException {@code USER_EMAIL_DUPLICATE} se o e-mail já estiver em uso.
     */
    @Transactional
    public UserResponseDTO createUser(UserRequestDTO dto) {
        validateEmailUnique(dto.email());

        String rawPassword = generateRandomPassword();

        User user = new User();
        user.setName(dto.name());
        user.setEmail(dto.email());
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(dto.role() != null ? dto.role() : UserRole.USER);
        user.setActive(dto.isActive() != null ? dto.isActive() : true);

        User saved = userRepository.save(user);
        log.info("Usuário criado: id={}, email={}", saved.getId(), saved.getEmail());

        sendWelcomeEmailSafely(saved, rawPassword);

        return UserResponseDTO.from(saved);
    }

    // -------------------------------------------------------------------------
    // Edição
    // -------------------------------------------------------------------------

    /**
     * Atualiza os dados editáveis de um usuário existente.
     *
     * <p>O campo {@code email} é ignorado nesta operação — o e-mail é imutável.</p>
     *
     * @param id  identificador do usuário a ser atualizado.
     * @param dto dados novos (apenas {@code name}, {@code role} e {@code isActive} são aplicados).
     * @return {@link UserResponseDTO} atualizado.
     * @throws AppException {@code USER_NOT_FOUND} se não existir usuário com o id informado.
     */
    @Transactional
    public UserResponseDTO updateUser(UUID id, UserRequestDTO dto) {
        User user = findUserOrThrow(id);

        user.setName(dto.name());
        user.setRole(dto.role());
        if (dto.isActive() != null) {
            user.setActive(dto.isActive());
        }

        User saved = userRepository.save(user);
        log.info("Usuário atualizado: id={}", saved.getId());

        return UserResponseDTO.from(saved);
    }

    // -------------------------------------------------------------------------
    // Redefinição de senha
    // -------------------------------------------------------------------------

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
        userRepository.save(user);

        log.info("Senha redefinida para o usuário: id={}", user.getId());

        sendWelcomeEmailSafely(user, rawPassword);
    }

    // -------------------------------------------------------------------------
    // Exclusão
    // -------------------------------------------------------------------------

    /**
     * Remove um usuário do sistema.
     *
     * <p>Um administrador não pode excluir a própria conta.</p>
     *
     * @param id identificador do usuário a ser removido.
     * @throws AppException {@code USER_NOT_FOUND}          se não existir usuário com o id informado.
     * @throws AppException {@code USER_CANNOT_DELETE_SELF} se o admin tentar excluir a própria conta.
     */
    @Transactional
    public void deleteUser(UUID id) {
        User user = findUserOrThrow(id);

        String currentUserEmail = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();

        if (user.getEmail().equals(currentUserEmail)) {
            throw AppException.userCannotDeleteSelf();
        }

        userRepository.delete(user);
        log.info("Usuário removido: id={}", id);
    }

    // -------------------------------------------------------------------------
    // Auxiliares privados
    // -------------------------------------------------------------------------

    /**
     * Busca um usuário pelo id ou lança {@link AppException} com código {@code USER_NOT_FOUND}.
     *
     * @param id identificador do usuário.
     * @return entidade {@link User}.
     */
    private User findUserOrThrow(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(AppException::userNotFound);
    }

    /**
     * Verifica se o e-mail já está em uso por outro usuário.
     *
     * @param email e-mail a verificar.
     * @throws AppException {@code USER_EMAIL_DUPLICATE} se já existir registro com o mesmo e-mail.
     */
    private void validateEmailUnique(String email) {
        if (userRepository.existsByEmail(email)) {
            throw AppException.userEmailDuplicate();
        }
    }

    /**
     * Gera uma senha aleatória de {@value #PASSWORD_LENGTH} caracteres
     * usando {@link SecureRandom} para garantir entropia adequada.
     *
     * @return senha em texto puro (não codificada).
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
     * Envia o e-mail de boas-vindas com a senha gerada, absorvendo falhas de SMTP
     * para não interromper a transação principal.
     *
     * <p>Em produção, considere persistir a senha temporária em fila de mensagens
     * (ex.: Outbox Pattern) para garantir entrega mesmo em falhas transitórias.</p>
     *
     * @param user        usuário destinatário.
     * @param rawPassword senha em texto puro recém-gerada.
     */
    private void sendWelcomeEmailSafely(User user, String rawPassword) {
        try {
            emailService.sendWelcomeEmail(user.getEmail(), user.getName(), rawPassword);
        } catch (Exception e) {
            log.error("HERMES-EMAIL-DEBUG | tipo={} | msg={} | causa={} | stacktrace=",
                e.getClass().getName(),
                e.getMessage(),
                e.getCause() != null ? e.getCause().getMessage() : "nenhuma",
                e
            );
            // NÃO relança — usuário já foi criado com sucesso.
            // Remover este bloco após identificar a causa.
        }
    }
}
