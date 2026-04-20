package com.hermes.controller;

import com.hermes.dto.dashboard.DashboardStatsDTO;
import com.hermes.dto.dashboard.LogEntryDTO;
import com.hermes.dto.PageResponseDTO;
import com.hermes.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * Controller responsável pelos endpoints de monitoramento e observabilidade do HERMES.
 * <p>
 * Expõe estatísticas consolidadas do sistema e logs de operação paginados,
 * consumidos pelo frontend para exibição no painel de controle em tempo real.
 * </p>
 *
 * @author HERMES Team
 */
@Slf4j
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@Validated
@Tag(name = "Dashboard", description = "Estatísticas e logs do sistema")
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * Retorna estatísticas consolidadas do sistema HERMES.
     * <p>
     * Inclui contagens de notificações por status, taxa de sucesso do dia,
     * volume total de envios e demais métricas exibidas no painel principal.
     * </p>
     *
     * @return {@link DashboardStatsDTO} com as métricas atuais do sistema
     */
    @GetMapping("/stats")
    @Operation(
            summary = "Estatísticas do sistema",
            description = "Retorna contagens por status de notificação, taxa de sucesso diária e demais métricas do painel."
    )
    @ApiResponse(responseCode = "200", description = "Estatísticas retornadas com sucesso")
    public ResponseEntity<DashboardStatsDTO> getStats() {
        DashboardStatsDTO stats = dashboardService.getStats();
        return ResponseEntity.ok(stats);
    }

    /**
     * Retorna logs paginados do sistema com filtro opcional por nível.
     * <p>
     * Os níveis de log refletem o estado das notificações processadas:
     * <ul>
     *   <li>{@code INFO}  — notificações enviadas com sucesso ou pendentes</li>
     *   <li>{@code WARN}  — notificações agendadas para envio futuro</li>
     *   <li>{@code ERROR} — notificações que falharam durante o processamento</li>
     * </ul>
     * </p>
     *
     * @param level filtro opcional pelo nível do log: INFO, WARN ou ERROR
     * @param page  número da página, 1-based (padrão: 1)
     * @param limit quantidade de itens por página (padrão: 20)
     * @return página de {@link LogEntryDTO} com metadados de paginação
     */
    @GetMapping("/logs")
    @Operation(
            summary = "Logs do sistema",
            description = "Retorna logs paginados do sistema, com filtro opcional por nível. "
                        + "INFO = enviados/pendentes | WARN = agendados | ERROR = falhas."
    )
    @ApiResponse(responseCode = "200", description = "Logs retornados com sucesso")
    public ResponseEntity<PageResponseDTO<LogEntryDTO>> getLogs(
            @Parameter(description = "Nível do log: INFO, WARN ou ERROR")
            @RequestParam(required = false) String level,
            @Parameter(description = "Número da página (1-based)")
            @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Quantidade de itens por página")
            @RequestParam(defaultValue = "20") int limit) {

        PageResponseDTO<LogEntryDTO> logs = dashboardService.getLogs(level, page, limit);
        return ResponseEntity.ok(logs);
    }
}