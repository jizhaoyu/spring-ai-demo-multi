package com.example.springaidemo.domain.agent;

import com.example.springaidemo.domain.memory.ConversationTurn;
import java.time.Instant;
import java.util.List;

public record AgentContext(
        String conversationId,
        String traceId,
        String tenantId,
        Instant requestedAt,
        List<ConversationTurn> recentTurns
) {
}
