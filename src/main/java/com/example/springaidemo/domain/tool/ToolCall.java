package com.example.springaidemo.domain.tool;

import java.time.Instant;

public record ToolCall(
        String toolName,
        String inputSummary,
        Instant startedAt,
        Instant finishedAt,
        String status
) {
}
