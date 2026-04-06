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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MultiAgentQaOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(MultiAgentQaOrchestrator.class);
    private static final Pattern JSON_MESSAGE_PATTERN = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]+)\"");
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
            int documentsScanned = searchResult.toolResult().documentsScanned();
            int matchedDocuments = searchResult.toolResult().matchedDocuments();
            String degradedReason = deriveDegradedReason(trace);
            String confidenceReason = deriveConfidenceReason(
                    answerDraft.confidence(),
                    matchedDocuments,
                    documentsScanned,
                    degradedReason,
                    plan.route()
            );
            List<String> recoveryActions = deriveRecoveryActions(answerDraft, matchedDocuments, degradedReason);

            AuditLog auditLog = new AuditLog(
                    context.traceId(),
                    startedAt,
                    Duration.between(startedAt, Instant.now()).toMillis(),
                    documentsScanned,
                    matchedDocuments,
                    degradedReason,
                    confidenceReason,
                    plan.route(),
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
                    documentsScanned,
                    matchedDocuments,
                    degradedReason,
                    confidenceReason,
                    plan.route(),
                    recoveryActions,
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
            logStageFallback("Planner", "local planner", exception);
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
            logStageFallback("Research", "local research agent", exception);
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
            logStageFallback("Response", "local response composer", exception);
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

    private String deriveDegradedReason(List<AgentTraceStep> trace) {
        for (AgentTraceStep step : trace) {
            if (!"degraded".equals(step.severity())) {
                continue;
            }
            String summary = step.summary();
            if (summary.contains("原因：")) {
                return summary.substring(summary.indexOf("原因：") + 3).trim();
            }
        }
        if (!this.runtimeStatusService.isModelEnhancedMode()) {
            return "当前使用本地降级模式，回答链路未调用外部模型。";
        }
        return trace.stream()
                .filter(step -> "degraded".equals(step.severity()))
                .map(AgentTraceStep::summary)
                .findFirst()
                .orElse(null);
    }

    private String deriveConfidenceReason(String confidence, int matchedDocuments, int documentsScanned,
            String degradedReason, String selectedStrategy) {
        String normalizedConfidence = StringUtils.hasText(confidence) ? confidence.trim().toUpperCase() : "MEDIUM";
        boolean degraded = StringUtils.hasText(degradedReason);
        return switch (normalizedConfidence) {
            case "LOW" -> matchedDocuments == 0
                    ? "未命中可靠证据片段，回答可信度较低。"
                    : "虽然命中 " + matchedDocuments + " 条证据，但当前链路存在降级或信息缺口，建议继续核对。";
            case "HIGH" -> degraded
                    ? "命中 " + matchedDocuments + " 条证据，但回答链路存在降级信号，建议结合验证工作台复核。"
                    : "已扫描 " + documentsScanned + " 份候选内容并命中 " + matchedDocuments + " 条证据，回答与策略 "
                            + selectedStrategy + " 保持一致。";
            default -> degraded
                    ? "命中 " + matchedDocuments + " 条证据，但链路存在降级信号，建议继续核对关键来源。"
                    : "命中 " + matchedDocuments + " 条证据，回答可用，但仍建议结合验证工作台检查细节。";
        };
    }

    private List<String> deriveRecoveryActions(AnswerDraft answerDraft, int matchedDocuments, String degradedReason) {
        List<String> explicitActions = answerDraft.recoveryActions() == null ? List.of() : answerDraft.recoveryActions();
        if (!explicitActions.isEmpty()) {
            return explicitActions;
        }
        List<String> actions = new ArrayList<>();
        if ("LOW".equalsIgnoreCase(answerDraft.confidence()) || matchedDocuments == 0) {
            actions.add("缩小问题范围后重试");
            actions.add("先选择一份文档，再重新提问");
            actions.add("更换关键词后继续追问");
        }
        else if ("MEDIUM".equalsIgnoreCase(answerDraft.confidence())) {
            actions.add("打开验证工作台核对证据");
            actions.add("如需更准，先限定一份文档后追问");
        }
        if (StringUtils.hasText(degradedReason)) {
            actions.add("重点查看验证工作台中的降级提示");
        }
        return actions.stream().distinct().toList();
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
        String normalized = message.replaceAll("[\\r\\n]+", " ").trim();
        String extractedMessage = extractApiMessage(normalized);
        String readableMessage = StringUtils.hasText(extractedMessage) ? extractedMessage : normalized;
        String localizedMessage = localizeReason(readableMessage, normalized);
        return localizedMessage.length() > 48 ? localizedMessage.substring(0, 48) + "..." : localizedMessage;
    }

    private void logStageFallback(String stageName, String fallbackName, Exception exception) {
        if (isExpectedRemoteFailure(exception)) {
            log.warn("{} stage failed, falling back to {}: {}", stageName, fallbackName, compactReason(exception));
            return;
        }
        log.warn("{} stage failed, falling back to {}", stageName, fallbackName, exception);
    }

    private String extractApiMessage(String message) {
        Matcher matcher = JSON_MESSAGE_PATTERN.matcher(message);
        return matcher.find() ? matcher.group(1).trim() : null;
    }

    private String localizeReason(String readableMessage, String rawMessage) {
        String lowerReadable = readableMessage.toLowerCase();
        String lowerRaw = rawMessage.toLowerCase();
        if (lowerRaw.contains("http 429") || lowerReadable.contains("overloaded")
                || lowerReadable.contains("rate limit")) {
            return "模型服务当前繁忙（HTTP 429），请稍后重试";
        }
        if (lowerRaw.contains("http 401") || lowerRaw.contains("http 403")
                || lowerReadable.contains("unauthorized") || lowerReadable.contains("forbidden")) {
            return "模型服务鉴权失败，请检查密钥或网关配置";
        }
        if (lowerReadable.contains("insufficient_quota") || lowerReadable.contains("quota")) {
            return "模型服务额度不足，请检查当前账号配额";
        }
        if (lowerReadable.contains("timeout") || lowerReadable.contains("timed out")) {
            return "模型服务响应超时，请稍后重试";
        }
        if (lowerReadable.contains("connection refused") || lowerReadable.contains("connect timed out")
                || lowerReadable.contains("unknown host")) {
            return "模型服务连接失败，请检查网络或网关配置";
        }
        return readableMessage;
    }

    private boolean isExpectedRemoteFailure(Exception exception) {
        Throwable current = exception;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        String message = current.getMessage();
        if (!StringUtils.hasText(message)) {
            return false;
        }
        String lowerMessage = message.toLowerCase();
        return lowerMessage.contains("http 429")
                || lowerMessage.contains("http 401")
                || lowerMessage.contains("http 403")
                || lowerMessage.contains("http 5")
                || lowerMessage.contains("overloaded")
                || lowerMessage.contains("rate limit")
                || lowerMessage.contains("quota")
                || lowerMessage.contains("timeout")
                || lowerMessage.contains("timed out")
                || lowerMessage.contains("connection refused")
                || lowerMessage.contains("connect timed out")
                || lowerMessage.contains("unknown host");
    }

    private record StageSpec(String key, String label) {
    }
}
