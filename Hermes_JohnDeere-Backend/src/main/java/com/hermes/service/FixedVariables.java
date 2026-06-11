package com.hermes.service;

import java.util.Set;

/**
 * Catálogo de variáveis fixas automáticas do sistema HERMES.
 *
 * <p>Variáveis fixas são resolvidas automaticamente pelo {@link EmailService}
 * no momento do envio, buscando os dados do destinatário pelo e-mail na tabela
 * {@code users}. Elas são resolvidas <em>antes</em> das variáveis dinâmicas do template.</p>
 *
 * <p><strong>Regras:</strong></p>
 * <ul>
 *   <li>Não aparecem no CSV/JSON de envio em massa — são automáticas.</li>
 *   <li>Não aparecem como campos preenchíveis na tela de notificação.</li>
 *   <li>Se o destinatário não for encontrado no banco, o placeholder é mantido intacto.</li>
 *   <li>Se um campo do usuário for {@code null} (ex: cargo), o placeholder é mantido intacto.</li>
 * </ul>
 *
 * <p><strong>Lista completa de variáveis fixas suportadas:</strong></p>
 * <table border="1">
 *   <tr><th>Variável</th><th>Fonte</th><th>Exemplo</th></tr>
 *   <tr><td>{@code {{PRIMEIRO_NOME}}}</td><td>primeira palavra de {@code user.name}</td><td>João</td></tr>
 *   <tr><td>{@code {{PRIMEIRO_ULTIMO_NOME}}}</td><td>primeira + última palavra de {@code user.name}</td><td>João Silva</td></tr>
 *   <tr><td>{@code {{NOME_COMPLETO}}}</td><td>{@code user.name} inteiro</td><td>João da Silva Santos</td></tr>
 *   <tr><td>{@code {{EMAIL}}}</td><td>{@code user.email}</td><td>joao@empresa.com</td></tr>
 *   <tr><td>{@code {{MATRICULA}}}</td><td>{@code user.matricula}</td><td>10001</td></tr>
 *   <tr><td>{@code {{CARGO}}}</td><td>{@code user.cargo}</td><td>Desenvolvedor Sênior</td></tr>
 *   <tr><td>{@code {{NOME_CELULA}}}</td><td>{@code user.celula.nome}</td><td>C1</td></tr>
 *   <tr><td>{@code {{GESTOR_NOME}}}</td><td>{@code user.celula.gestor.name}</td><td>Maria Santos</td></tr>
 *   <tr><td>{@code {{GESTOR_PRIMEIRO_NOME}}}</td><td>primeira palavra do nome do gestor</td><td>Maria</td></tr>
 *   <tr><td>{@code {{GESTOR_EMAIL}}}</td><td>{@code user.celula.gestor.email}</td><td>maria@empresa.com</td></tr>
 *   <tr><td>{@code {{DATA_HOJE}}}</td><td>gerado pelo sistema</td><td>30/05/2026</td></tr>
 *   <tr><td>{@code {{DATA_HORA_ENVIO}}}</td><td>gerado pelo sistema</td><td>30/05/2026 às 14:32</td></tr>
 *   <tr><td>{@code {{MES_ANO}}}</td><td>gerado pelo sistema</td><td>Maio de 2026</td></tr>
 *   <tr><td>{@code {{ANO}}}</td><td>gerado pelo sistema</td><td>2026</td></tr>
 *   <tr><td>{@code {{DIA_SEMANA}}}</td><td>gerado pelo sistema</td><td>Sexta-feira</td></tr>
 *   <tr><td>{@code {{SAUDACAO}}}</td><td>gerado pelo sistema pela hora</td><td>Bom dia / Boa tarde / Boa noite</td></tr>
 * </table>
 */
public final class FixedVariables {

    private FixedVariables() {
        // Classe utilitária — não instanciar.
    }

    // ─── Variáveis derivadas do usuário ──────────────────────────────────────

    public static final String PRIMEIRO_NOME         = "PRIMEIRO_NOME";
    public static final String PRIMEIRO_ULTIMO_NOME  = "PRIMEIRO_ULTIMO_NOME";
    public static final String NOME_COMPLETO         = "NOME_COMPLETO";
    public static final String EMAIL                 = "EMAIL";
    public static final String MATRICULA             = "MATRICULA";
    public static final String CARGO                 = "CARGO";

    // ─── Variáveis derivadas da célula ────────────────────────────────────────

    public static final String NOME_CELULA           = "NOME_CELULA";
    public static final String GESTOR_NOME           = "GESTOR_NOME";
    public static final String GESTOR_PRIMEIRO_NOME  = "GESTOR_PRIMEIRO_NOME";
    public static final String GESTOR_EMAIL          = "GESTOR_EMAIL";

    // ─── Variáveis geradas pelo sistema ──────────────────────────────────────

    public static final String DATA_HOJE             = "DATA_HOJE";
    public static final String DATA_HORA_ENVIO       = "DATA_HORA_ENVIO";
    public static final String MES_ANO               = "MES_ANO";
    public static final String ANO                   = "ANO";
    public static final String DIA_SEMANA            = "DIA_SEMANA";
    public static final String SAUDACAO              = "SAUDACAO";

    /**
     * Conjunto imutável de todos os nomes de variáveis fixas.
     * Usado pelo frontend e pelo service para filtrar variáveis que não devem
     * ser exibidas como campos preenchíveis.
     */
    public static final Set<String> ALL = Set.of(
            PRIMEIRO_NOME, PRIMEIRO_ULTIMO_NOME, NOME_COMPLETO,
            EMAIL, MATRICULA, CARGO,
            NOME_CELULA, GESTOR_NOME, GESTOR_PRIMEIRO_NOME, GESTOR_EMAIL,
            DATA_HOJE, DATA_HORA_ENVIO, MES_ANO, ANO, DIA_SEMANA, SAUDACAO
    );
}