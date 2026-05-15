package com.hermes.entity.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Collections;
import java.util.List;

/**
 * Converter JPA que serializa/deserializa {@code List<String>} como JSON string (coluna {@code jsonb}).
 *
 * <p>Utilizado nos campos {@code variables} de {@link com.hermes.entity.TemplateVersion}.</p>
 *
 * <p><strong>Uso:</strong> anotar o campo com {@code @Convert(converter = StringListConverter.class)}.</p>
 */
@Converter(autoApply = false)
public class StringListConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> TYPE_REF = new TypeReference<>() {};

    /**
     * Converte {@code List<String>} em JSON string para persistência no banco.
     *
     * @param attribute lista de strings; pode ser {@code null}
     * @return JSON string representando a lista, ou {@code null} se o atributo for {@code null}
     */
    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao serializar List<String> para JSON", e);
        }
    }

    /**
     * Converte JSON string do banco em {@code List<String>}.
     *
     * @param dbData JSON string; pode ser {@code null} ou vazio
     * @return lista de strings; lista vazia se {@code dbData} for {@code null} ou vazio
     */
    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao deserializar JSON para List<String>", e);
        }
    }
}