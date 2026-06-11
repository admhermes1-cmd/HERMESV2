package com.hermes.dto.notification;

import java.util.List;

/**
 * DTO de resposta para operações de envio em massa de notificações.
 *
 * <p>Contém um resumo agregado da operação e listas detalhadas de sucessos
 * e falhas, permitindo que o cliente apresente um relatório linha a linha
 * sem precisar fazer chamadas adicionais à API.</p>
 *
 * <p>Cada destinatário do arquivo CSV/JSON é processado de forma independente
 * — uma falha em uma linha não interrompe o processamento das demais.</p>
 *
 * @param total      número total de registros encontrados no arquivo
 * @param successful número de envios concluídos com sucesso
 * @param failed     número de envios que falharam
 * @param successes  lista detalhada dos envios bem-sucedidos
 * @param failures   lista detalhada dos envios que falharam, com motivo
 */
public record BulkNotificationResultDTO(
        int total,
        int successful,
        int failed,
        List<BulkSuccessItem> successes,
        List<BulkFailureItem> failures
) {

    /**
     * Item de sucesso individual dentro do resultado de envio em massa.
     *
     * @param line  número da linha no arquivo original (1-based, sem contar o cabeçalho)
     * @param email endereço de e-mail do destinatário que recebeu a notificação
     * @param name  nome do destinatário, se disponível no arquivo (pode ser {@code null})
     */
    public record BulkSuccessItem(
            int line,
            String email,
            String name
    ) {}

    /**
     * Item de falha individual dentro do resultado de envio em massa.
     *
     * @param line   número da linha no arquivo original (1-based, sem contar o cabeçalho)
     * @param email  endereço de e-mail do destinatário que falhou (pode ser {@code null}
     *               se a própria coluna email estava ausente ou inválida)
     * @param reason descrição legível da causa da falha
     */
    public record BulkFailureItem(
            int line,
            String email,
            String reason
    ) {}
}