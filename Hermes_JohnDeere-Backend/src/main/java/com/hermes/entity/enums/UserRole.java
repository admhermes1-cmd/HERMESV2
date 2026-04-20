package com.hermes.entity.enums;

/**
 * Papel (role) de um usuário no sistema HERMES.
 *
 * <ul>
 *   <li>{@link #ADMIN} — acesso total: gerencia usuários, templates e visualiza todos os logs.</li>
 *   <li>{@link #USER}  — acesso restrito: envia notificações e gerencia seus próprios templates.</li>
 * </ul>
 */
public enum UserRole {

    /** Administrador com acesso irrestrito ao sistema. */
    ADMIN,

    /** Usuário padrão com acesso limitado às suas próprias operações. */
    USER
}