package com.example.springaidemo.domain.tool;

import java.util.List;

public record KnowledgeCatalogPayload(
        String rootLabel,
        int documentCount,
        List<KnowledgeCatalogNode> nodes,
        RuntimeStatus runtimeStatus
) {
}
