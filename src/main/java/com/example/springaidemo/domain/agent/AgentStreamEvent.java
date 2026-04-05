package com.example.springaidemo.domain.agent;

import com.example.springaidemo.domain.tool.RuntimeStatus;

public record AgentStreamEvent(
        String type,
        String conversationId,
        String traceId,
        String stageKey,
        String stageLabel,
        String status,
        String severity,
        String message,
        RuntimeStatus runtimeStatus,
        AgentResponse response
) {
}
