package com.example.springaidemo.infra.retrieval;

import com.example.springaidemo.application.runtime.AssistantRuntimeStatusService;
import com.example.springaidemo.application.tool.KnowledgeSearchTool;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.tool.Citation;
import com.example.springaidemo.domain.tool.KnowledgeCatalogPayload;
import com.example.springaidemo.domain.tool.KnowledgeSearchResult;
import com.example.springaidemo.domain.tool.ToolCall;
import com.example.springaidemo.domain.tool.ToolDefinition;
import com.example.springaidemo.domain.tool.ToolResult;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class LocalKnowledgeSearchTool implements KnowledgeSearchTool {

    private static final ToolDefinition TOOL_DEFINITION = new ToolDefinition(
            "knowledge_search",
            "按语义相关度检索内部 Markdown 知识库。"
    );

    private final KnowledgeBaseProperties properties;
    private final KnowledgeBaseIndexer knowledgeBaseIndexer;
    private final AssistantRuntimeStatusService runtimeStatusService;

    public LocalKnowledgeSearchTool(KnowledgeBaseProperties properties, KnowledgeBaseIndexer knowledgeBaseIndexer,
            AssistantRuntimeStatusService runtimeStatusService) {
        this.properties = properties;
        this.knowledgeBaseIndexer = knowledgeBaseIndexer;
        this.runtimeStatusService = runtimeStatusService;
    }

    @Override
    public KnowledgeCatalogPayload catalog() {
        return this.knowledgeBaseIndexer.catalogPayload(this.runtimeStatusService.currentStatus());
    }

    @Override
    public KnowledgeSearchResult search(String query, AgentContext context) {
        Instant startedAt = Instant.now();
        String effectiveQuery = StringUtils.hasText(query) ? query.trim() : "知识库检索";
        if (!this.knowledgeBaseIndexer.hasSearchableContent()) {
            return KnowledgeSearchResult.failed(
                    "检索词=" + effectiveQuery,
                    "知识库当前不可用，已按无证据模式继续。"
            );
        }

        List<Citation> citations = this.knowledgeBaseIndexer.chunks().stream()
                .map(chunk -> new ScoredChunk(chunk, scoreChunk(effectiveQuery, chunk)))
                .filter(scoredChunk -> scoredChunk.score() >= lexicalThreshold())
                .sorted((left, right) -> Double.compare(right.score(), left.score()))
                .limit(this.properties.getTopK())
                .map(scoredChunk -> toCitation(scoredChunk.chunk()))
                .toList();
        int documentsScanned = this.knowledgeBaseIndexer.chunks().size();

        Instant finishedAt = Instant.now();
        ToolCall toolCall = new ToolCall(
                TOOL_DEFINITION.name(),
                "检索词=" + effectiveQuery,
                startedAt,
                finishedAt,
                "SUCCESS"
        );
        ToolResult toolResult = new ToolResult(
                TOOL_DEFINITION.name(),
                citations.isEmpty() ? "没有找到匹配当前问题的证据片段。" : "已检索到 " + citations.size() + " 条证据片段。",
                citations.size(),
                documentsScanned,
                citations.size()
        );
        return new KnowledgeSearchResult(TOOL_DEFINITION, toolCall, toolResult, citations);
    }

    private Citation toCitation(KnowledgeBaseIndexer.KnowledgeChunk chunk) {
        return new Citation(
                chunk.sourceId(),
                chunk.title(),
                shorten(chunk.content(), 220)
        );
    }

    private String shorten(String value, int maxLength) {
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength - 3).trim() + "...";
    }

    private double lexicalThreshold() {
        return Math.min(this.properties.getMinScore(), 0.18d);
    }

    private double scoreChunk(String query, KnowledgeBaseIndexer.KnowledgeChunk chunk) {
        String normalizedQuery = normalize(query);
        String title = normalize(chunk.title() + " " + chunk.summary());
        String content = normalize(chunk.content());
        String combined = title + " " + content;
        Set<String> terms = extractTerms(normalizedQuery);

        double score = 0;
        if (!normalizedQuery.isBlank() && combined.contains(normalizedQuery)) {
            score += 2.5d;
        }
        for (String term : terms) {
            if (content.contains(term)) {
                score += 1;
            }
            if (title.contains(term)) {
                score += 1.4d;
            }
        }

        double normalizedScore = score / Math.max(terms.size(), 1);
        return Math.min(normalizedScore, 1.0d);
    }

    private Set<String> extractTerms(String value) {
        Set<String> terms = new LinkedHashSet<>();
        for (String segment : value.split("[^\\p{IsHan}\\p{IsAlphabetic}\\p{IsDigit}]+")) {
            if (segment.isBlank()) {
                continue;
            }
            if (segment.codePointCount(0, segment.length()) >= 2) {
                terms.add(segment);
            }
            if (containsHan(segment)) {
                terms.addAll(createHanBigrams(segment));
            }
        }
        return terms;
    }

    private boolean containsHan(String value) {
        return value.codePoints().anyMatch(codePoint -> Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN);
    }

    private List<String> createHanBigrams(String value) {
        List<String> terms = new ArrayList<>();
        String normalized = value.replaceAll("\\s+", "");
        int length = normalized.length();
        if (length <= 2) {
            terms.add(normalized);
            return terms;
        }
        for (int index = 0; index < length - 1; index++) {
            terms.add(normalized.substring(index, index + 2));
        }
        return terms;
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private record ScoredChunk(
            KnowledgeBaseIndexer.KnowledgeChunk chunk,
            double score
    ) {
    }

}
