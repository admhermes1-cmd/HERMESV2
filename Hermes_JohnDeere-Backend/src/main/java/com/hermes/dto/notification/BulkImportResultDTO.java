package com.hermes.dto.notification;

import java.util.List;

/**
 * DTO de resposta consolidada para uma operação de importação em massa de usuários.
 * <p>
 * Contém o resumo da operação (totais) e as listas detalhadas de linhas
 * importadas com sucesso e de linhas que falharam com suas respectivas mensagens
 * de erro, permitindo ao cliente exibir um relatório granular ao operador.
 * </p>
 *
 * @param totalRows       Total de linhas recebidas no arquivo
 * @param successCount    Número de usuários criados com sucesso
 * @param failureCount    Número de linhas que falharam
 * @param successfulUsers Lista de e-mails dos usuários criados com sucesso
 * @param failures        Lista de {@link RowFailure} descrevendo cada linha com erro
 */
public record BulkImportResultDTO(
        int totalRows,
        int successCount,
        int failureCount,
        List<String> successfulUsers,
        List<RowFailure> failures
) {

    /**
     * Detalhe de uma linha que falhou na importação.
     *
     * @param rowIndex    Índice da linha no arquivo (1-based para exibição)
     * @param email       E-mail da linha (pode ser nulo/inválido)
     * @param errorReason Mensagem descritiva do motivo da falha
     */
    public record RowFailure(
            int rowIndex,
            String email,
            String errorReason
    ) {}
}