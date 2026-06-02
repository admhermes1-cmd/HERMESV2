package com.hermes.dto.user;

import com.hermes.entity.User;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO de saída completo para um único usuário.
 *
 * <p>Expõe todos os campos públicos, incluindo a {@code apiKey}, adequado para a tela
 * de detalhes/edição. O campo {@code password} nunca é exposto.</p>
 *
 * @param id                 Identificador único do usuário.
 * @param name               Nome completo.
 * @param email              Endereço de e-mail (imutável após criação).
 * @param role               Papel no sistema: {@code ADMIN}, {@code GESTOR} ou {@code USER}.
 * @param apiKey             Chave de API gerada automaticamente no cadastro.
 * @param isActive           Indica se a conta está ativa.
 * @param mustChangePassword Indica se o usuário deve alterar a senha no próximo acesso.
 * @param matricula          Matrícula única auto-incremental gerada pelo backend.
 * @param cargo              Cargo ou função do usuário na empresa (pode ser {@code null}).
 * @param celula             Dados resumidos da célula à qual o usuário pertence.
 * @param createdAt          Data e hora de criação do registro.
 * @param updatedAt          Data e hora da última atualização.
 */
public record UserResponseDTO(
        UUID id,
        String name,
        String email,
        String role,
        String apiKey,
        boolean isActive,
        boolean mustChangePassword,
        Integer matricula,
        String cargo,
        CelulaResumoDTO celula,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    /**
     * Constrói um {@link UserResponseDTO} a partir da entidade {@link User}.
     *
     * @param user entidade de domínio; não deve ser {@code null}.
     * @return DTO populado.
     */
    public static UserResponseDTO from(User user) {
        return new UserResponseDTO(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getApiKey(),
                user.isActive(),
                user.isMustChangePassword(),
                user.getMatricula(),
                user.getCargo(),
                CelulaResumoDTO.from(user.getCelula()),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    /**
     * DTO resumido da célula para exibição dentro de um usuário.
     *
     * @param id   UUID da célula.
     * @param nome Nome da célula (ex: "C1").
     */
    public record CelulaResumoDTO(UUID id, String nome) {

        /**
         * Converte a entidade {@link com.hermes.entity.Celula} em {@link CelulaResumoDTO}.
         * Retorna {@code null} se a célula for {@code null} (usuário sem célula vinculada).
         *
         * @param celula entidade da célula; pode ser {@code null}.
         * @return DTO resumido ou {@code null}.
         */
        public static CelulaResumoDTO from(com.hermes.entity.Celula celula) {
            if (celula == null) return null;
            return new CelulaResumoDTO(celula.getId(), celula.getNome());
        }
    }
}