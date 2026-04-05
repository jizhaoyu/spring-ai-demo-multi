package com.example.springaidemo.domain.tool;

import java.util.List;

public record KnowledgeCatalogNode(
        String id,
        String label,
        String path,
        String type,
        String summary,
        List<KnowledgeCatalogNode> children
) {
}
