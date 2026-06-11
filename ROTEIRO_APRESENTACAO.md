# Roteiro de Apresentação — HERMES (Sistema de Notificações)

> Stack: Spring Boot 3 (Java 17) + PostgreSQL no backend, React + Vite no frontend, autenticação JWT.

## 1. Abertura — visão geral (1 min)
- Objetivo do sistema: gestão e envio de notificações (e-mail via SendGrid), com templates,
  envio individual/em massa, gestão de usuários e dashboard de monitoramento.
- Arquitetura: API REST (Spring Boot) consumida por uma SPA em React.
- Autenticação via JWT (access token + refresh token).

## 2. Login e autenticação
- Tela de login (`/login`).
- Fluxo de **primeiro acesso**: usuário criado pelo admin recebe `mustChangePassword = true`
  e é redirecionado para `/change-password` antes de poder usar o sistema.

## 3. Dashboard (`/dashboard`)
- Estatísticas consolidadas: contagem de notificações por status, taxa de sucesso do dia,
  volume total de envios.
- Logs paginados de operações do sistema — útil para auditoria/observabilidade.

## 4. Templates de notificação (`/templates`)
- Listagem de templates (criação/edição restrita a ADMIN).
- Criar um template novo (`/templates/new`): assunto + corpo com variáveis `{{variavel}}`.
- **Versionamento**: cada template pode ter múltiplas versões (`/templates/{id}/versions`),
  permitindo editar sem perder histórico.

## 5. Envio de notificação individual (`/notifications/new`)
- Selecionar template, escolher destinatário(s), preencher variáveis do template.
- Suporte a anexos (multipart) — ex. PDF.
- Resultado: notificação criada com status PENDING → SENT (ou FAILED).
- Ações de **cancelar** e **reenviar (retry)** uma notificação.

## 6. Envio em massa (`/notifications/bulk`)
- Upload de planilha/CSV com lista de destinatários + variáveis.
- Processamento em lote, com relatório de sucesso/falha por linha.

## 7. Gestão de usuários (`/users`)
- CRUD completo de usuários (nome, e-mail, cargo, role ADMIN/GESTOR/USER, ativo/inativo).
- **Reset de senha** pelo admin (gera senha temporária, força troca no próximo login).
- **Importação em massa de usuários** (`/api/v1/users/bulk-import`) — upload de planilha,
  com relatório de linhas importadas e falhas.
- Cada usuário recebe uma **matrícula** única, gerada automaticamente na criação.
- **Célula é opcional** na criação do usuário (dropdown com opção "Sem célula") —
  pode ser atribuída depois, na edição.
- Papel **GESTOR**: permissões intermediárias — gerencia os USERs da própria célula,
  mas não pode alterar/criar ADMIN ou outro GESTOR.

## 8. Células (`/celulas`)
- Agrupamento de usuários em "células" (times/grupos), gerenciado por ADMIN/GESTOR.
- **Gestor é opcional** na criação da célula (dropdown com opção "Sem gestor") — pode
  ser atribuído depois, na edição. Cada GESTOR só pode gerenciar **uma** célula por vez.
- ADMIN pode editar qualquer célula e reatribuir o gestor; GESTOR só pode editar a
  própria célula e não pode trocar o gestor.
- Vincular usuários a uma célula (`/celulas/{id}/usuarios`).
- **Fluxo recomendado para configurar uma célula com gestor (sem dependência circular):**
  1. ADMIN cria a célula sem gestor ("Sem gestor").
  2. ADMIN cria (ou edita) um usuário com role GESTOR, sem célula vinculada.
  3. ADMIN edita a célula e seleciona esse usuário como gestor.

## 9. Perfil e segurança
- Troca de senha pelo próprio usuário (`/change-password`).
- Logout e expiração/renovação (refresh) do token JWT.
- Controle de acesso por role: rotas administrativas (templates, usuários, células)
  protegidas por `PrivateRoute`.

## 10. Encerramento
- Recapitular o fluxo ponta a ponta:
  criar template → criar/importar usuários → enviar notificação (individual ou em massa)
  → acompanhar no dashboard.
