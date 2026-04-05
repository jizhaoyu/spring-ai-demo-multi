package com.example.springaidemo.domain.agent;

import jakarta.validation.constraints.NotBlank;

public record AgentRequest(
        @NotBlank(message = "question must not be blank")
        String question,
        String conversationId
) {
}
