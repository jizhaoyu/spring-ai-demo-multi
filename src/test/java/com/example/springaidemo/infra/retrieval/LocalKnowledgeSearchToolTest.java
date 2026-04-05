package com.example.springaidemo.infra.retrieval;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.springaidemo.application.runtime.AssistantRuntimeStatusService;
import com.example.springaidemo.domain.tool.KnowledgeCatalogPayload;
import com.example.springaidemo.domain.tool.KnowledgeSearchResult;
import org.junit.jupiter.api.Test;

class LocalKnowledgeSearchToolTest {

    @Test
    void searchFindsTheMostRelevantKnowledgeChunk() {
        LocalKnowledgeSearchTool tool = createTool("none");

        KnowledgeSearchResult result = tool.search("申请生产环境访问权限需要什么条件？", null);

        assertThat(result.citations()).isNotEmpty();
        assertThat(result.citations().getFirst().title()).isEqualTo("支持策略");
        assertThat(result.toolResult().itemCount()).isGreaterThan(0);
    }

    @Test
    void catalogIncludesRuntimeStatusForFallbackMode() {
        LocalKnowledgeSearchTool tool = createTool("none");

        KnowledgeCatalogPayload payload = tool.catalog();

        assertThat(payload.documentCount()).isEqualTo(3);
        assertThat(payload.runtimeStatus().code()).isEqualTo("degraded");
        assertThat(payload.nodes()).isNotEmpty();
    }

    @Test
    void catalogReportsNormalModeWhenModelEnhanced() {
        LocalKnowledgeSearchTool tool = createTool("openai");

        KnowledgeCatalogPayload payload = tool.catalog();

        assertThat(payload.runtimeStatus().code()).isEqualTo("normal");
    }

    @Test
    void searchFindsMaintenanceWindowEvidence() {
        LocalKnowledgeSearchTool tool = createTool("none");

        KnowledgeSearchResult result = tool.search("维护窗口是什么时候？", null);

        assertThat(result.citations()).isNotEmpty();
        assertThat(result.citations().getFirst().title()).isEqualTo("运维操作手册");
    }

    private LocalKnowledgeSearchTool createTool(String chatModelMode) {
        KnowledgeBaseProperties properties = new KnowledgeBaseProperties();
        properties.setResourcePattern("classpath*:knowledge-base/**/*.md");
        properties.setTopK(2);
        properties.setMinScore(0.1);

        KnowledgeBaseIndexer indexer = new KnowledgeBaseIndexer(properties);
        indexer.initialize();

        AssistantRuntimeStatusService runtimeStatusService = new AssistantRuntimeStatusService(indexer, chatModelMode);
        return new LocalKnowledgeSearchTool(properties, indexer, runtimeStatusService);
    }
}
