package com.hermes.dto.auth;

import com.hermes.entity.User;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO de resposta para o endpoint {@code POST /auth/login} e {@code GET /auth/me}.
 *
 * <p>Encapsula o token JWT, o refresh token e os dados públicos do usuário autenticado.
 * Implementado como Java Record para garantir imutabilidade e concisão.</p>
 *
 * @param user         dados públicos do usuário autenticado (sem a senha)
 * @param token        token JWT para autenticação nas requisições subsequentes
 * @param refreshToken token para renovação do JWT sem reautenticação
 */
public record LoginResponseDTO(
        UserDTO user,
        String token,
        String refreshToken
) {

    /**
     * Factory method que monta o {@link LoginResponseDTO} completo a partir da entidade
     * {@link User} e dos tokens gerados pelo serviço de autenticação.
     *
     * @param user         entidade do usuário autenticado
     * @param token        token JWT recém-gerado
     * @param refreshToken refresh token recém-gerado
     * @return instância pronta para serialização JSON
     */
    public static LoginResponseDTO of(User user, String token, String refreshToken) {
        return new LoginResponseDTO(UserDTO.from(user), token, refreshToken);
    }

    /**
     * Representação pública do usuário autenticado.
     *
     * <p>Expõe apenas os campos seguros — o campo {@code password} da entidade
     * {@link User} é deliberadamente omitido em qualquer mapeamento.</p>
     *
     * @param id        identificador único do usuário
     * @param name      nome completo do usuário
     * @param email     endereço de e-mail
     * @param role      papel do usuário no sistema (ex: {@code ADMIN}, {@code USER})
     * @param apiKey    chave de API gerada para o usuário
     * @param isActive  indica se a conta está ativa
     * @param createdAt data e hora de criação da conta
     */
    public record UserDTO(
            UUID id,
            String name,
            String email,
            String role,
            String apiKey,
            boolean isActive,
            boolean mustChangePassword,
            LocalDateTime createdAt
    ) {
        /**
         * Converte a entidade {@link User} para {@link UserDTO}.
         *
         * <p><strong>Atenção:</strong> o campo {@code password} nunca é incluído
         * nesta conversão — essa invariante deve ser preservada em qualquer
         * refatoração futura.</p>
         *
         * @param user entidade do domínio
         * @return DTO sem informações sensíveis
         */
        public static UserDTO from(User user) {
            return new UserDTO(
                    user.getId(),
                    user.getName(),
                    user.getEmail(),
                    user.getRole().name(),
                    user.getApiKey(),
                    user.isActive(),
                    user.getMustChangePassword(),
                    user.getCreatedAt()
            );
        }
    }
}