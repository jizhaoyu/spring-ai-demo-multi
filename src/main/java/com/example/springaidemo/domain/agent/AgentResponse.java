package com.example.springaidemo.domain.agent;

import com.example.springaidemo.domain.tool.Citation;
import java.util.List;

public record AgentResponse(
        String conversationId,
        String traceId,
        String answer,
        String confidence,
        List<String> followUpQuestions,
        List<Citation> sources,
        AuditLog auditLog
) {
}
