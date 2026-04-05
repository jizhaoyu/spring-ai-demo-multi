package com.example.springaidemo.domain.agent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record QueryPlan(
        @NotBlank String route,
        @NotBlank String normalizedQuestion,
        @NotBlank String retrievalQuery,
        @NotBlank String answerLanguage,
        @NotEmpty List<String> focusPoints
) {
}
