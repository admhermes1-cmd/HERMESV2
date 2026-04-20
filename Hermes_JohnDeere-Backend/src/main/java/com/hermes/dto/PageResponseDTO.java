package com.hermes.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * DTO de resposta genérico para endpoints de listagem paginada.
 *
 * <p>Padroniza o envelope de paginação em toda a API do HERMES, garantindo que
 * todos os controllers de listagem retornem exatamente o shape esperado pelo frontend:</p>
 * <pre>
 * {
 *   "data":  [...],
 *   "total": 42,
 *   "page":  1,
 *   "limit": 10
 * }
 * </pre>
 *
 * <p>Exemplo de uso em um controller:</p>
 * <pre>{@code
 * Page<Template> page = templateRepository.findAll(pageable);
 * List<TemplateResponseDTO> dtos = page.getContent()
 *         .stream()
 *         .map(TemplateResponseDTO::fromWithoutVersions)
 *         .toList();
 *
 * return PageResponseDTO.from(page, dtos, currentPage, limit);
 * }</pre>
 *
 * @param <T>   tipo dos itens na lista — deve ser um DTO de response
 * @param data  lista de itens da página atual
 * @param total número total de registros (todas as páginas)
 * @param page  número da página atual — <strong>1-based</strong> na API, mesmo que o
 *              Spring Data use indexação 0-based internamente
 * @param limit número máximo de itens por página
 */
public record PageResponseDTO<T>(
        List<T> data,
        long total,
        int page,
        int limit
) {

    /**
     * Converte um {@link Page} do Spring Data em {@link PageResponseDTO}, recebendo
     * a lista de DTOs já mapeados externamente.
     *
     * <p>Este é o factory method recomendado quando a conversão de entidade para DTO
     * já foi realizada antes da chamada (ex: stream + map no controller ou service).</p>
     *
     * @param <T>         tipo dos itens de DTO
     * @param springPage  resultado paginado retornado pelo repository
     * @param mappedData  lista de DTOs já convertidos a partir de {@code springPage.getContent()}
     * @param currentPage página atual no esquema <strong>1-based</strong> da API
     * @param limit       número de itens por página
     * @return instância com metadados de paginação e a lista mapeada
     */
    public static <T> PageResponseDTO<T> from(
            Page<?> springPage,
            List<T> mappedData,
            int currentPage,
            int limit
    ) {
        return new PageResponseDTO<>(
                mappedData,
                springPage.getTotalElements(),
                currentPage,
                limit
        );
    }

    /**
     * Converte um {@link Page} do Spring Data em {@link PageResponseDTO} quando
     * o tipo do {@code Page} já é o DTO final (sem necessidade de mapeamento adicional).
     *
     * <p>Útil para projeções ou quando o repository já retorna o tipo correto.</p>
     *
     * @param <T>         tipo dos itens — deve ser o DTO de response
     * @param springPage  página do Spring Data já com o tipo final
     * @param currentPage página atual no esquema <strong>1-based</strong> da API
     * @param limit       número de itens por página
     * @return instância com metadados de paginação
     */
    public static <T> PageResponseDTO<T> from(
            Page<T> springPage,
            int currentPage,
            int limit
    ) {
        return new PageResponseDTO<>(
                springPage.getContent(),
                springPage.getTotalElements(),
                currentPage,
                limit
        );
    }
}