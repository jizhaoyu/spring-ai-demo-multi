package com.example.springaidemo.domain.memory;

import java.time.Instant;

public record ConversationTurn(
        String role,
        String content,
        Instant createdAt
) {
}
