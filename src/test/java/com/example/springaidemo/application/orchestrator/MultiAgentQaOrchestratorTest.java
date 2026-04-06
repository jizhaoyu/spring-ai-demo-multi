package com.example.springaidemo.application.orchestrator;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.springaidemo.application.agent.QueryPlannerAgent;
import com.example.springaidemo.application.agent.ResearchAgent;
import com.example.springaidemo.application.agent.ResponseComposerAgent;
import com.example.springaidemo.application.memory.ConversationMemory;
import com.example.springaidemo.application.runtime.AssistantRuntimeStatusService;
import com.example.springaidemo.application.tool.KnowledgeSearchTool;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.AgentResponse;
import com.example.springaidemo.domain.agent.AnswerDraft;
import com.example.springaidemo.domain.agent.QueryPlan;
import com.example.springaidemo.domain.agent.ResearchBrief;
import com.example.springaidemo.domain.memory.ConversationTurn;
import com.example.springaidemo.domain.tool.Citation;
import com.example.springaidemo.domain.tool.KnowledgeCatalogPayload;
import com.example.springaidemo.domain.tool.KnowledgeSearchResult;
import com.example.springaidemo.domain.tool.RuntimeStatus;
import com.example.springaidemo.domain.tool.ToolCall;
import com.example.springaidemo.domain.tool.ToolDefinition;
import com.example.springaidemo.domain.tool.ToolResult;
import com.example.springaidemo.infra.retrieval.KnowledgeBaseIndexer;
import com.example.springaidemo.infra.retrieval.KnowledgeBaseProperties;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MultiAgentQaOrchestratorTest {

    @Test
    void answerBuildsAuditTrailAndStoresConversation() {
        RecordingConversationMemory memory = new RecordingConversationMemory();
        MultiAgentQaOrchestrator orchestrator = new MultiAgentQaOrchestrator(
                planner(),
                searchTool(),
                researchAgent(),
                responseAgent(),
                memory,
                runtimeStatusService(false)
        );

        AgentResponse response = orchestrator.answer(new AgentRequest(
                "标准支持的响应时间是多久？",
                "conv-42"
        ));

        assertThat(response.conversationId()).isEqualTo("conv-42");
        assertThat(response.answer()).contains("4 个工作小时");
        assertThat(response.sources()).hasSize(1);
        assertThat(response.documentsScanned()).isEqualTo(3);
        assertThat(response.matchedDocuments()).isEqualTo(1);
        assertThat(response.degradedReason()).isNotBlank();
        assertThat(response.confidenceReason()).contains("证据");
        assertThat(response.selectedStrategy()).isEqualTo("KB_LOOKUP");
        assertThat(response.auditLog().agentTrace()).hasSize(4);
        assertThat(response.auditLog().agentTrace()).anyMatch(step -> "degraded".equals(step.severity()));
        assertThat(response.auditLog().agentTrace()).anyMatch(step -> "normal".equals(step.severity()));
        assertThat(memory.recordedAssistantReply).contains("4 个工作小时");
    }

    @Test
    void answerPublishesStreamingStagesInOrder() {
        RecordingConversationMemory memory = new RecordingConversationMemory();
        MultiAgentQaOrchestrator orchestrator = new MultiAgentQaOrchestrator(
                planner(),
                searchTool(),
                researchAgent(),
                responseAgent(),
                memory,
                runtimeStatusService(false)
        );
        RecordingExecutionListener listener = new RecordingExecutionListener();

        AgentResponse response = orchestrator.answer(new AgentRequest(
                "维护窗口是什么时候？",
                null
        ), listener);

        assertThat(response.answer()).isNotBlank();
        assertThat(listener.events).containsExactly(
                "session",
                "planner:started",
                "planner:completed",
                "retrieval:started",
                "retrieval:completed",
                "research:started",
                "research:completed",
                "response:started",
                "response:completed",
                "done"
        );
    }

    @Test
    void answerGeneratesConversationIdWhenMissing() {
        MultiAgentQaOrchestrator orchestrator = new MultiAgentQaOrchestrator(
                planner(),
                searchTool(),
                researchAgent(),
                responseAgent(),
                new RecordingConversationMemory(),
                runtimeStatusService(false)
        );

        AgentResponse response = orchestrator.answer(new AgentRequest(
                "你好",
                null
        ));

        assertThat(response.conversationId()).isNotBlank();
        assertThat(response.traceId()).isNotBlank();
    }

    @Test
    void answerUsesFriendlyFallbackReasonWhenModelIsOverloaded() {
        MultiAgentQaOrchestrator orchestrator = new MultiAgentQaOrchestrator(
                (request, context) -> {
                    throw overloadedFailure();
                },
                searchTool(),
                (request, context, plan, citations) -> {
                    throw overloadedFailure();
                },
                (request, context, plan, researchBrief, citations) -> {
                    throw overloadedFailure();
                },
                new RecordingConversationMemory(),
                runtimeStatusService(true)
        );

        AgentResponse response = orchestrator.answer(new AgentRequest(
                "登录异常怎么处理？",
                "conv-overloaded"
        ));

        assertThat(response.answer()).isNotBlank();
        assertThat(response.degradedReason()).contains("模型服务当前繁忙（HTTP 429），请稍后重试");
        assertThat(response.recoveryActions()).isNotEmpty();
        assertThat(response.auditLog().agentTrace())
                .filteredOn(step -> "degraded".equals(step.severity()))
                .extracting(step -> step.summary())
                .allSatisfy(summary -> {
                    assertThat(summary).contains("模型服务当前繁忙（HTTP 429），请稍后重试");
                    assertThat(summary).doesNotContain("{\"error\"");
                    assertThat(summary).doesNotContain("engine_overloaded_error");
                    assertThat(summary).doesNotContain("The engine is currently overloaded");
                });
    }

    private QueryPlannerAgent planner() {
        return (request, context) -> new QueryPlan(
                "KB_LOOKUP",
                request.question(),
                "standard support response time",
                "zh-CN",
                List.of("Use the support policy.")
        );
    }

    private KnowledgeSearchTool searchTool() {
        return new KnowledgeSearchTool() {
            @Override
            public KnowledgeSearchResult search(String query, AgentContext context) {
                Citation citation = new Citation(
                        "support/policies.md",
                        "支持策略",
                        "标准支持在周一到周五 UTC 时间 08:00 到 18:00 之间提供服务，响应时限为 4 个工作小时内。"
                );
                Instant now = Instant.now();
                return new KnowledgeSearchResult(
                        new ToolDefinition("knowledge_search", "test"),
                        new ToolCall("knowledge_search", query, now, now, "SUCCESS"),
                        new ToolResult("knowledge_search", "已检索到 1 条证据片段。", 1, 3, 1),
                        List.of(citation)
                );
            }

            @Override
            public KnowledgeCatalogPayload catalog() {
                return new KnowledgeCatalogPayload("默认知识库", 0, List.of(), RuntimeStatus.degraded("当前使用本地降级链路。"));
            }
        };
    }

    private AssistantRuntimeStatusService runtimeStatusService(boolean modelEnhanced) {
        KnowledgeBaseProperties properties = new KnowledgeBaseProperties();
        properties.setResourcePattern("classpath*:knowledge-base/**/*.md");
        KnowledgeBaseIndexer indexer = new KnowledgeBaseIndexer(properties);
        indexer.initialize();
        return new AssistantRuntimeStatusService(indexer, modelEnhanced ? "openai" : "none");
    }

    private ResearchAgent researchAgent() {
        return (request, context, plan, citations) -> new ResearchBrief(
                "SUPPORTED",
                "标准支持会在 4 个工作小时内响应。",
                List.of("标准支持在工作时间段内处理问题。", "优先支持响应更快。"),
                List.of(),
                List.of("先回答 SLA。", "补充说明支持时间。")
        );
    }

    private ResponseComposerAgent responseAgent() {
        return (request, context, plan, researchBrief, citations) -> new AnswerDraft(
                "标准支持会在 UTC 08:00 到 18:00 的服务时段内，于 4 个工作小时内响应。来源：支持策略。",
                "HIGH",
                List.of("是否还需要查看优先支持的响应时限？"),
                List.of()
        );
    }

    private RuntimeException overloadedFailure() {
        return new IllegalStateException(
                "planner stage failed",
                new RuntimeException(
                        "HTTP 429 - {\"error\":{\"message\":\"The engine is currently overloaded, please try again later\",\"type\":\"engine_overloaded_error\"}}"
                )
        );
    }

    private static class RecordingConversationMemory implements ConversationMemory {
        private final List<ConversationTurn> history = new ArrayList<>();
        private String recordedAssistantReply;

        @Override
        public List<ConversationTurn> recentTurns(String conversationId) {
            return List.copyOf(this.history);
        }

        @Override
        public void appendExchange(String conversationId, String userMessage, String assistantMessage) {
            this.history.add(new ConversationTurn("user", userMessage, Instant.now()));
            this.history.add(new ConversationTurn("assistant", assistantMessage, Instant.now()));
            this.recordedAssistantReply = assistantMessage;
        }
    }

    private static class RecordingExecutionListener implements AgentExecutionListener {
        private final List<String> events = new ArrayList<>();

        @Override
        public void onSessionStarted(com.example.springaidemo.domain.agent.AgentContext context) {
            this.events.add("session");
        }

        @Override
        public void onStageStarted(String stageKey, String stageLabel, String message, String severity) {
            this.events.add(stageKey + ":started");
        }

        @Override
        public void onStageCompleted(String stageKey, String stageLabel, String message, long latencyMs, String severity) {
            this.events.add(stageKey + ":completed");
        }

        @Override
        public void onCompleted(AgentResponse response) {
            this.events.add("done");
        }
    }
}
