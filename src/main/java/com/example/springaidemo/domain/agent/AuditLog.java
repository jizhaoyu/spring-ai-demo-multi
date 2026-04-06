package com.example.springaidemo.domain.agent;

import com.example.springaidemo.domain.tool.ToolCall;
import com.example.springaidemo.domain.tool.ToolResult;
import java.time.Instant;
import java.util.List;

public record AuditLog(
        String traceId,
        Instant createdAt,
        long totalLatencyMs,
        int documentsScanned,
        int matchedDocuments,
        String degradedReason,
        String confidenceReason,
        String selectedStrategy,
        List<AgentTraceStep> agentTrace,
        List<ToolCall> toolCalls,
        List<ToolResult> toolResults
) {
}
