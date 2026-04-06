package com.example.springaidemo.domain.agent;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record AnswerDraft(
        @NotBlank String answer,
        @NotBlank String confidence,
        List<String> followUpQuestions,
        List<String> recoveryActions
) {
}
