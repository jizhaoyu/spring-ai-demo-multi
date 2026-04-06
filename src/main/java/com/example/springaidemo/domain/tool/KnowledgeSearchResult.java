package com.example.springaidemo.domain.tool;

import java.time.Instant;
import java.util.List;

public record KnowledgeSearchResult(
        ToolDefinition toolDefinition,
        ToolCall toolCall,
        ToolResult toolResult,
        List<Citation> citations
) {

    public static KnowledgeSearchResult skipped(String inputSummary) {
        Instant now = Instant.now();
        ToolDefinition definition = new ToolDefinition(
                "knowledge_search",
                "按相关度检索内部知识库。"
        );
        return new KnowledgeSearchResult(
                definition,
                new ToolCall(definition.name(), inputSummary, now, now, "SKIPPED"),
                new ToolResult(definition.name(), "当前请求无需检索知识库，已直接跳过。", 0, 0, 0),
                List.of()
        );
    }

    public static KnowledgeSearchResult failed(String inputSummary, String message) {
        Instant now = Instant.now();
        ToolDefinition definition = new ToolDefinition(
                "knowledge_search",
                "按相关度检索内部知识库。"
        );
        return new KnowledgeSearchResult(
                definition,
                new ToolCall(definition.name(), inputSummary, now, now, "FAILED"),
                new ToolResult(definition.name(), message, 0, 0, 0),
                List.of()
        );
    }
}
