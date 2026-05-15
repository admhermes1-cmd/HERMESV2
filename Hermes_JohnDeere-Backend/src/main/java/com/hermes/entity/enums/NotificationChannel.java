package com.hermes.entity.enums;

/**
 * Canal de entrega disponível no sistema HERMES.
 *
 * <p>O canal é definido no {@link Template} e é <strong>imutável</strong> após a criação.
 * Cada {@link Notification} herda o canal do template utilizado.</p>
 */
public enum NotificationChannel {

    /** Envio via protocolo SMTP/e-mail, suportando subject e corpo HTML. */
    EMAIL,

    /** Envio via SMS — corpo em texto simples, sem subject. */
    SMS,

    /** Envio via WhatsApp Business API — corpo em texto simples ou template aprovado. */
    WHATSAPP
}