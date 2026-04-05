package com.example.springaidemo.domain.agent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ResearchBrief(
        @NotBlank String supportLevel,
        @NotBlank String executiveSummary,
        @NotEmpty List<String> keyFindings,
        List<String> gaps,
        List<String> answerOutline
) {
}
