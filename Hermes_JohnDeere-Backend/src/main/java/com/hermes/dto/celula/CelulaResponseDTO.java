package com.hermes.dto.celula;

import com.hermes.entity.Celula;
import com.hermes.entity.User;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO de saída resumido para listagem paginada de células.
 *
 * <p>Não inclui a lista completa de usuários — use {@link CelulaDetalheDTO}
 * para o endpoint de detalhes individuais.</p>
 *
 * @param id            Identificador único da célula.
 * @param nome          Nome da célula (ex: "C1").
 * @param gestor        Dados resumidos do gestor responsável.
 * @param totalUsuarios Contagem de usuários vinculados à célula.
 * @param createdAt     Data e hora de criação.
 */
public record CelulaResponseDTO(
        UUID id,
        String nome,
        GestorDTO gestor,
        int totalUsuarios,
        LocalDateTime createdAt
) {

    /**
     * Converte uma entidade {@link Celula} em {@link CelulaResponseDTO}.
     *
     * @param celula        entidade de domínio; não deve ser {@code null}.
     * @param totalUsuarios contagem de usuários vinculados, obtida via
     *                      {@code UserRepository.countByCelula} para evitar
     *                      carregar a coleção {@code usuarios} inteira (N+1).
     * @return DTO resumido populado.
     */
    public static CelulaResponseDTO from(Celula celula, long totalUsuarios) {
        return new CelulaResponseDTO(
                celula.getId(),
                celula.getNome(),
                GestorDTO.from(celula.getGestor()),
                (int) totalUsuarios,
                celula.getCreatedAt()
        );
    }

    /**
     * DTO aninhado com dados mínimos do gestor para exibição em listagens.
     *
     * @param id    UUID do gestor.
     * @param nome  Nome completo do gestor.
     * @param email E-mail do gestor.
     */
    public record GestorDTO(UUID id, String nome, String email) {

        /**
         * Converte um {@link User} gestor em {@link GestorDTO}.
         * Retorna {@code null} se o gestor for {@code null} (célula sem gestor atribuído).
         *
         * @param gestor entidade do gestor; pode ser {@code null}.
         * @return DTO do gestor ou {@code null}.
         */
        public static GestorDTO from(User gestor) {
            if (gestor == null) return null;
            return new GestorDTO(gestor.getId(), gestor.getName(), gestor.getEmail());
        }
    }
}