package com.example.springaidemo.application.orchestrator;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class StructuredJsonParser {

    private static final Pattern FENCED_JSON = Pattern.compile("(?s)^```(?:json)?\\s*(.*?)\\s*```$");
    private final ObjectMapper objectMapper;
    private final Validator validator;

    public StructuredJsonParser(ObjectMapper objectMapper, Validator validator) {
        this.objectMapper = objectMapper.copy()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.validator = validator;
    }

    public <T> T parse(String raw, Class<T> type) {
        try {
            T value = this.objectMapper.readValue(extractJson(raw), type);
            validate(value);
            return value;
        }
        catch (Exception exception) {
            throw new IllegalArgumentException("Failed to parse structured response", exception);
        }
    }

    private String extractJson(String raw) {
        String candidate = raw == null ? "" : raw.trim();
        Matcher fencedMatcher = FENCED_JSON.matcher(candidate);
        if (fencedMatcher.matches()) {
            candidate = fencedMatcher.group(1).trim();
        }
        int firstBrace = candidate.indexOf('{');
        int lastBrace = candidate.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return candidate.substring(firstBrace, lastBrace + 1);
        }
        return candidate;
    }

    @SuppressWarnings("unchecked")
    private <T> void validate(T value) {
        Set<ConstraintViolation<T>> violations = this.validator.validate(value);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException((Set<ConstraintViolation<?>>) (Set<?>) violations);
        }
    }
}
