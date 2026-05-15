package com.hermes.entity.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.entity.Notification.RecipientsData;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Converter JPA que serializa/deserializa {@link RecipientsData} como JSON string (coluna {@code jsonb}).
 *
 * <p>Persiste os destinatários de uma {@link com.hermes.entity.Notification} nos campos
 * {@code to}, {@code cc} e {@code bcc} dentro de um único documento JSON.</p>
 *
 * <p><strong>Uso:</strong> anotar o campo com {@code @Convert(converter = RecipientsConverter.class)}.</p>
 */
@Converter(autoApply = false)
public class RecipientsConverter implements AttributeConverter<RecipientsData, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Serializa {@link RecipientsData} para JSON string.
     *
     * @param attribute estrutura de destinatários; pode ser {@code null}
     * @return JSON string, ou {@code null}
     */
    @Override
    public String convertToDatabaseColumn(RecipientsData attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao serializar RecipientsData para JSON", e);
        }
    }

    /**
     * Deserializa JSON string para {@link RecipientsData}.
     *
     * @param dbData JSON string; pode ser {@code null} ou vazio
     * @return instância de {@link RecipientsData}, ou {@code null}
     */
    @Override
    public RecipientsData convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(dbData, RecipientsData.class);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao deserializar JSON para RecipientsData", e);
        }
    }
}