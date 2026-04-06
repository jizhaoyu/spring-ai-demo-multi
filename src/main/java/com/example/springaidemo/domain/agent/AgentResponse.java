package com.example.springaidemo.domain.agent;

import com.example.springaidemo.domain.tool.Citation;
import java.util.List;

public record AgentResponse(
        String conversationId,
        String traceId,
        String answer,
        String confidence,
        List<String> followUpQuestions,
        int documentsScanned,
        int matchedDocuments,
        String degradedReason,
        String confidenceReason,
        String selectedStrategy,
        List<String> recoveryActions,
        List<Citation> sources,
        AuditLog auditLog
) {
}
