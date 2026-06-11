package com.hermes.dto.celula;

import com.hermes.dto.user.UserListResponseDTO;
import com.hermes.entity.Celula;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO de saída detalhado para o endpoint {@code GET /celulas/{id}}.
 *
 * <p>Inclui a lista completa de usuários vinculados à célula, ao contrário de
 * {@link CelulaResponseDTO}, que exibe apenas a contagem total.</p>
 *
 * @param id        Identificador único da célula.
 * @param nome      Nome da célula (ex: "C1").
 * @param gestor    Dados resumidos do gestor responsável.
 * @param usuarios  Lista de usuários vinculados à célula.
 * @param createdAt Data e hora de criação.
 * @param updatedAt Data e hora da última atualização.
 */
public record CelulaDetalheDTO(
        UUID id,
        String nome,
        CelulaResponseDTO.GestorDTO gestor,
        List<UserListResponseDTO> usuarios,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    /**
     * Converte uma entidade {@link Celula} em {@link CelulaDetalheDTO}.
     *
     * <p>A coleção {@code celula.getUsuarios()} deve estar inicializada antes da chamada
     * (sem lazy-loading pendente). Garantir dentro de uma transação ativa no service.</p>
     *
     * @param celula entidade de domínio; não deve ser {@code null}.
     * @return DTO detalhado populado.
     */
    public static CelulaDetalheDTO from(Celula celula) {
        List<UserListResponseDTO> usuarioDTOs = celula.getUsuarios()
                .stream()
                .map(UserListResponseDTO::from)
                .toList();

        return new CelulaDetalheDTO(
                celula.getId(),
                celula.getNome(),
                CelulaResponseDTO.GestorDTO.from(celula.getGestor()),
                usuarioDTOs,
                celula.getCreatedAt(),
                celula.getUpdatedAt()
        );
    }
}