package com.example.springaidemo.domain.agent;

public record AgentTraceStep(
        String agentName,
        String summary,
        long latencyMs,
        String severity
) {
}
