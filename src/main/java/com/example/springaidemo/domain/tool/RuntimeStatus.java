package com.example.springaidemo.domain.tool;

public record RuntimeStatus(
        String code,
        String label,
        String message
) {

    public static RuntimeStatus normal(String message) {
        return new RuntimeStatus("normal", "正常模式", message);
    }

    public static RuntimeStatus degraded(String message) {
        return new RuntimeStatus("degraded", "降级模式", message);
    }

    public static RuntimeStatus offline(String message) {
        return new RuntimeStatus("offline", "知识库离线", message);
    }
}
