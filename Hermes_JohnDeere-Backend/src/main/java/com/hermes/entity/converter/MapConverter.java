package com.hermes.entity.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Collections;
import java.util.Map;

/**
 * Converter JPA que serializa/deserializa {@code Map<String, String>} como JSON string (coluna {@code jsonb}).
 *
 * <p>Utilizado no campo {@code variables} de {@link com.hermes.entity.Notification},
 * onde cada chave é o nome da variável do template e o valor é o conteúdo a substituir.</p>
 *
 * <p><strong>Uso:</strong> anotar o campo com {@code @Convert(converter = MapConverter.class)}.</p>
 */
@Converter(autoApply = false)
public class MapConverter implements AttributeConverter<Map<String, String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, String>> TYPE_REF = new TypeReference<>() {};

    /**
     * Converte {@code Map<String, String>} em JSON string para persistência.
     *
     * @param attribute mapa de variáveis; pode ser {@code null}
     * @return JSON string do mapa, ou {@code null}
     */
    @Override
    public String convertToDatabaseColumn(Map<String, String> attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao serializar Map<String,String> para JSON", e);
        }
    }

    /**
     * Converte JSON string do banco em {@code Map<String, String>}.
     *
     * @param dbData JSON string; pode ser {@code null} ou vazio
     * @return mapa de variáveis; mapa vazio se {@code dbData} for {@code null} ou vazio
     */
    @Override
    public Map<String, String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Erro ao deserializar JSON para Map<String,String>", e);
        }
    }
}