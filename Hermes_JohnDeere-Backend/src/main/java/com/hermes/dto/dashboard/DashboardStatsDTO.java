package com.hermes.dto.dashboard;

/**
 * DTO de resposta para as estatísticas agregadas do dashboard HERMES.
 *
 * <p>Retornado pelo endpoint {@code GET /dashboard/stats} e atualizado
 * periodicamente pelo frontend via polling ou WebSocket.</p>
 *
 * @param sent        total de notificações enviadas com sucesso no período
 * @param failed      total de notificações com falha no período
 * @param scheduled   total de notificações agendadas ainda aguardando envio
 * @param pending     total de notificações em fila aguardando processamento
 * @param totalToday  total de notificações criadas no dia atual
 * @param successRate taxa de sucesso no intervalo {@code [0.0, 1.0]} —
 *                    ex: {@code 0.9734} representa 97,34% de sucesso
 */
public record DashboardStatsDTO(
        long sent,
        long failed,
        long scheduled,
        long pending,
        long totalToday,
        double successRate
) {

    /**
     * Cria um {@link DashboardStatsDTO} calculando automaticamente a taxa de sucesso.
     *
     * <p>A taxa de sucesso é calculada como:</p>
     * <pre>
     *   successRate = sent / (sent + failed)
     * </pre>
     * <p>Retorna {@code 0.0} quando {@code sent + failed == 0} para evitar divisão por zero.</p>
     *
     * @param sent        total de notificações enviadas com sucesso
     * @param failed      total de notificações com falha
     * @param scheduled   total de notificações agendadas
     * @param pending     total de notificações pendentes
     * @param totalToday  total de notificações criadas hoje
     * @return instância com {@code successRate} calculado
     */
    public static DashboardStatsDTO of(
            long sent,
            long failed,
            long scheduled,
            long pending,
            long totalToday
    ) {
        long total = sent + failed;
        double successRate = total == 0 ? 0.0 : (double) sent / total;
        return new DashboardStatsDTO(sent, failed, scheduled, pending, totalToday, successRate);
    }
}