package com.hermes.entity.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.entity.Notification.AttachmentMetadata;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Collections;
import java.util.List;

/**
 * Converter JPA que serializa/deserializa {@code List<AttachmentMetadata>} como JSON string
 * (coluna {@code jsonb}).
 *
 * <p>Apenas metadados (nome e tamanho) são persistidos — o arquivo binário em si
 * <strong>não</strong> é armazenado no banco de dados.</p>
 *
 * <p><strong>Uso:</strong> anotar o campo com {@code @Convert(converter = AttachmentListConverter.class)}.</p>
 */
@Converter(autoApply = false)
public class AttachmentListConverter implements AttributeConverter<List<AttachmentMetadata>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<AttachmentMetadata>> TYPE_REF = new TypeReference<>() {};

    /**
     * Serializa {@code List<AttachmentMetadata>} para JSON string.
     *
     * @param attribute lista de metadados de anexos; pode ser {@code null}
     * @return JSON string, ou {@code null}
     */
    @Override
    public String convertToDatabaseColumn(List<AttachmentMetadata> attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao serializar List<AttachmentMetadata> para JSON", e);
        }
    }

    /**
     * Deserializa JSON string para {@code List<AttachmentMetadata>}.
     *
     * @param dbData JSON string; pode ser {@code null} ou vazio
     * @return lista de metadados; lista vazia se {@code dbData} for {@code null} ou vazio
     */
    @Override
    public List<AttachmentMetadata> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao deserializar JSON para List<AttachmentMetadata>", e);
        }
    }
}