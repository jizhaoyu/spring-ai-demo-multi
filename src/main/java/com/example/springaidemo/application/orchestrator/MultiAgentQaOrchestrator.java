package com.example.springaidemo.application.orchestrator;

import com.example.springaidemo.application.agent.QueryPlannerAgent;
import com.example.springaidemo.application.agent.ResearchAgent;
import com.example.springaidemo.application.agent.ResponseComposerAgent;
import com.example.springaidemo.application.memory.ConversationMemory;
import com.example.springaidemo.application.runtime.AssistantRuntimeStatusService;
import com.example.springaidemo.application.tool.KnowledgeSearchTool;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.AgentResponse;
import com.example.springaidemo.domain.agent.AgentTraceStep;
import com.example.springaidemo.domain.agent.AnswerDraft;
import com.example.springaidemo.domain.agent.AuditLog;
import com.example.springaidemo.domain.agent.QueryPlan;
import com.example.springaidemo.domain.agent.ResearchBrief;
import com.example.springaidemo.domain.tool.KnowledgeSearchResult;
import com.example.springaidemo.infra.fallback.LocalFallbackQueryPlannerAgent;
import com.example.springaidemo.infra.fallback.LocalFallbackResearchAgent;
import com.example.springaidemo.infra.fallback.LocalFallbackResponseComposerAgent;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MultiAgentQaOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(MultiAgentQaOrchestrator.class);
    private static final StageSpec PLANNER_STAGE = new StageSpec("planner", "规划");
    private static final StageSpec RETRIEVAL_STAGE = new StageSpec("retrieval", "检索");
    private static final StageSpec RESEARCH_STAGE = new StageSpec("research", "研究");
    private static final StageSpec RESPONSE_STAGE = new StageSpec("response", "生成");

    private final QueryPlannerAgent queryPlannerAgent;
    private final KnowledgeSearchTool knowledgeSearchTool;
    private final ResearchAgent researchAgent;
    private final ResponseComposerAgent responseComposerAgent;
    private final ConversationMemory conversationMemory;
    private final AssistantRuntimeStatusService runtimeStatusService;
    private final LocalFallbackQueryPlannerAgent fallbackQueryPlannerAgent = new LocalFallbackQueryPlannerAgent();
    private final LocalFallbackResearchAgent fallbackResearchAgent = new LocalFallbackResearchAgent();
    private final LocalFallbackResponseComposerAgent fallbackResponseComposerAgent = new LocalFallbackResponseComposerAgent();

    public MultiAgentQaOrchestrator(QueryPlannerAgent queryPlannerAgent, KnowledgeSearchTool knowledgeSearchTool,
            ResearchAgent researchAgent, ResponseComposerAgent responseComposerAgent,
            ConversationMemory conversationMemory, AssistantRuntimeStatusService runtimeStatusService) {
        this.queryPlannerAgent = queryPlannerAgent;
        this.knowledgeSearchTool = knowledgeSearchTool;
        this.researchAgent = researchAgent;
        this.responseComposerAgent = responseComposerAgent;
        this.conversationMemory = conversationMemory;
        this.runtimeStatusService = runtimeStatusService;
    }

    public AgentResponse answer(AgentRequest request) {
        return execute(request, AgentExecutionListener.NO_OP);
    }

    public AgentResponse answer(AgentRequest request, AgentExecutionListener listener) {
        return execute(request, listener == null ? AgentExecutionListener.NO_OP : listener);
    }

    private AgentResponse execute(AgentRequest request, AgentExecutionListener listener) {
        Instant startedAt = Instant.now();
        String conversationId = StringUtils.hasText(request.conversationId())
                ? request.conversationId().trim()
                : UUID.randomUUID().toString();
        AgentContext context = new AgentContext(
                conversationId,
                UUID.randomUUID().toString(),
                "demo-tenant",
                startedAt,
                this.conversationMemory.recentTurns(conversationId)
        );

        listener.onSessionStarted(context);
        List<AgentTraceStep> trace = new ArrayList<>();
        try {
            QueryPlan plan = executePlannerStage(request, context, trace, listener);
            KnowledgeSearchResult searchResult = executeRetrievalStage(request, context, trace, plan, listener);
            ResearchBrief researchBrief = executeResearchStage(request, context, trace, plan, searchResult, listener);
            AnswerDraft answerDraft = executeResponseStage(request, context, trace, plan, researchBrief, searchResult,
                    listener);

            this.conversationMemory.appendExchange(conversationId, request.question(), answerDraft.answer());

            AuditLog auditLog = new AuditLog(
                    context.traceId(),
                    startedAt,
                    Duration.between(startedAt, Instant.now()).toMillis(),
                    List.copyOf(trace),
                    List.of(searchResult.toolCall()),
                    List.of(searchResult.toolResult())
            );

            AgentResponse response = new AgentResponse(
                    conversationId,
                    context.traceId(),
                    answerDraft.answer(),
                    answerDraft.confidence(),
                    answerDraft.followUpQuestions(),
                    searchResult.citations(),
                    auditLog
            );
            listener.onCompleted(response);
            return response;
        }
        catch (Exception exception) {
            listener.onError("system", "系统", "执行阶段失败，请查看日志或重试。", exception, "error");
            throw exception;
        }
    }

    private QueryPlan executePlannerStage(AgentRequest request, AgentContext context, List<AgentTraceStep> trace,
            AgentExecutionListener listener) {
        listener.onStageStarted(PLANNER_STAGE.key(), PLANNER_STAGE.label(), "正在分析问题并规划检索策略。", stageModeSeverity());
        Instant startedAt = Instant.now();
        try {
            QueryPlan plan = this.queryPlannerAgent.plan(request, context);
            String summary = "路由策略：" + plan.route() + "；检索词：" + plan.retrievalQuery();
            return completeStage(trace, listener, PLANNER_STAGE, startedAt, summary, plan, stageModeSeverity());
        }
        catch (Exception exception) {
            log.warn("Planner stage failed, falling back to local planner", exception);
            QueryPlan fallbackPlan = this.fallbackQueryPlannerAgent.plan(request, context);
            String summary = "规划代理调用模型失败，已切换到本地规划策略。原因：" + compactReason(exception);
            return completeStage(trace, listener, PLANNER_STAGE, startedAt, summary, fallbackPlan, "degraded");
        }
    }

    private KnowledgeSearchResult executeRetrievalStage(AgentRequest request, AgentContext context,
            List<AgentTraceStep> trace, QueryPlan plan, AgentExecutionListener listener) {
        listener.onStageStarted(RETRIEVAL_STAGE.key(), RETRIEVAL_STAGE.label(), "正在从知识库中检索相关证据。", "normal");
        if ("DIRECT_REPLY".equalsIgnoreCase(plan.route())) {
            KnowledgeSearchResult searchResult = KnowledgeSearchResult.skipped(plan.retrievalQuery());
            String summary = "当前问题属于直接回复场景，已跳过知识检索。";
            trace.add(new AgentTraceStep("knowledge-search", summary, 0, "normal"));
            listener.onStageCompleted(RETRIEVAL_STAGE.key(), RETRIEVAL_STAGE.label(), summary, 0, "normal");
            return searchResult;
        }

        Instant searchStartedAt = Instant.now();
        try {
            KnowledgeSearchResult searchResult = this.knowledgeSearchTool.search(plan.retrievalQuery(), context);
            long latencyMs = Duration.between(searchStartedAt, Instant.now()).toMillis();
            String summary = searchResult.toolResult().outputSummary();
            trace.add(new AgentTraceStep("knowledge-search", summary, latencyMs, "normal"));
            listener.onStageCompleted(RETRIEVAL_STAGE.key(), RETRIEVAL_STAGE.label(), summary, latencyMs, "normal");
            return searchResult;
        }
        catch (Exception exception) {
            log.warn("Retrieval stage failed, continuing without citations", exception);
            KnowledgeSearchResult fallbackResult = KnowledgeSearchResult.failed(
                    "检索词=" + plan.retrievalQuery(),
                    "知识检索失败，已按无证据模式继续。"
            );
            long latencyMs = Duration.between(searchStartedAt, Instant.now()).toMillis();
            String summary = fallbackResult.toolResult().outputSummary();
            trace.add(new AgentTraceStep("knowledge-search", summary, latencyMs, "degraded"));
            listener.onStageCompleted(RETRIEVAL_STAGE.key(), RETRIEVAL_STAGE.label(), summary, latencyMs, "degraded");
            return fallbackResult;
        }
    }

    private ResearchBrief executeResearchStage(AgentRequest request, AgentContext context, List<AgentTraceStep> trace,
            QueryPlan plan, KnowledgeSearchResult searchResult, AgentExecutionListener listener) {
        listener.onStageStarted(RESEARCH_STAGE.key(), RESEARCH_STAGE.label(), "正在整合证据并形成研究摘要。", stageModeSeverity());
        Instant startedAt = Instant.now();
        try {
            ResearchBrief researchBrief = this.researchAgent.research(request, context, plan, searchResult.citations());
            String summary = "支持级别：" + researchBrief.supportLevel() + "；" + researchBrief.executiveSummary();
            return completeStage(trace, listener, RESEARCH_STAGE, startedAt, summary, researchBrief, stageModeSeverity());
        }
        catch (Exception exception) {
            log.warn("Research stage failed, falling back to local research agent", exception);
            ResearchBrief fallbackResearch = this.fallbackResearchAgent.research(
                    request,
                    context,
                    plan,
                    searchResult.citations()
            );
            String summary = "研究代理调用模型失败，已切换到本地研究策略。原因：" + compactReason(exception);
            return completeStage(trace, listener, RESEARCH_STAGE, startedAt, summary, fallbackResearch, "degraded");
        }
    }

    private AnswerDraft executeResponseStage(AgentRequest request, AgentContext context, List<AgentTraceStep> trace,
            QueryPlan plan, ResearchBrief researchBrief, KnowledgeSearchResult searchResult,
            AgentExecutionListener listener) {
        listener.onStageStarted(RESPONSE_STAGE.key(), RESPONSE_STAGE.label(), "正在生成最终回答与引用。", stageModeSeverity());
        Instant startedAt = Instant.now();
        try {
            AnswerDraft answerDraft = this.responseComposerAgent.answer(
                    request,
                    context,
                    plan,
                    researchBrief,
                    searchResult.citations()
            );
            String summary = "已生成回答，置信度：" + answerDraft.confidence() + "。";
            return completeStage(trace, listener, RESPONSE_STAGE, startedAt, summary, answerDraft, stageModeSeverity());
        }
        catch (Exception exception) {
            log.warn("Response stage failed, falling back to local response composer", exception);
            AnswerDraft fallbackAnswer = this.fallbackResponseComposerAgent.answer(
                    request,
                    context,
                    plan,
                    researchBrief,
                    searchResult.citations()
            );
            String summary = "生成代理调用模型失败，已切换到本地回答策略。原因：" + compactReason(exception);
            return completeStage(trace, listener, RESPONSE_STAGE, startedAt, summary, fallbackAnswer, "degraded");
        }
    }

    private <T> T completeStage(List<AgentTraceStep> trace, AgentExecutionListener listener, StageSpec stage,
            Instant startedAt, String summary, T result, String severity) {
        long latencyMs = Duration.between(startedAt, Instant.now()).toMillis();
        trace.add(new AgentTraceStep(stage.key(), summary, latencyMs, severity));
        listener.onStageCompleted(stage.key(), stage.label(), summary, latencyMs, severity);
        return result;
    }

    private String stageModeSeverity() {
        return this.runtimeStatusService.isModelEnhancedMode() ? "normal" : "degraded";
    }

    private String compactReason(Exception exception) {
        Throwable current = exception;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        String message = current.getMessage();
        if (!StringUtils.hasText(message)) {
            return current.getClass().getSimpleName();
        }
        return message.length() > 120 ? message.substring(0, 120) + "..." : message;
    }

    private record StageSpec(String key, String label) {
    }
}
