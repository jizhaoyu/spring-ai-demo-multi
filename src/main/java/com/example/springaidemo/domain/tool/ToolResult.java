package com.example.springaidemo.domain.tool;

public record ToolResult(
        String toolName,
        String outputSummary,
        int itemCount,
        int documentsScanned,
        int matchedDocuments
) {
}
