package com.hermes.entity.enums;

/**
 * Papel (role) de um usuário no sistema HERMES.
 *
 * <ul>
 *   <li>{@link #ADMIN}  — acesso total: gerencia usuários, células, templates e todos os logs.</li>
 *   <li>{@link #GESTOR} — acesso intermediário: gerencia USERs da sua célula, templates e notificações.
 *                         Não pode criar, editar ou excluir outros GESTORes ou ADMINs.</li>
 *   <li>{@link #USER}   — acesso restrito: envia notificações e gerencia seus próprios templates.</li>
 * </ul>
 */
public enum UserRole {

    /** Administrador com acesso irrestrito ao sistema. */
    ADMIN,

    /**
     * Gestor de célula — acesso intermediário.
     *
     * <p>Pode:</p>
     * <ul>
     *   <li>Visualizar e editar células</li>
     *   <li>Criar, editar e desativar usuários com role {@code USER}</li>
     *   <li>Criar/editar templates e enviar notificações</li>
     * </ul>
     * <p>Não pode criar, editar ou excluir usuários com role {@code ADMIN} ou {@code GESTOR}.</p>
     */
    GESTOR,

    /** Usuário padrão com acesso limitado às suas próprias operações. */
    USER
}
