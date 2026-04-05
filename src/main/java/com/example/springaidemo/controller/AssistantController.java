package com.example.springaidemo.controller;

import com.example.springaidemo.application.orchestrator.AgentExecutionListener;
import com.example.springaidemo.application.orchestrator.MultiAgentQaOrchestrator;
import com.example.springaidemo.application.runtime.AssistantRuntimeStatusService;
import com.example.springaidemo.application.tool.KnowledgeSearchTool;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.AgentResponse;
import com.example.springaidemo.domain.agent.AgentStreamEvent;
import com.example.springaidemo.domain.tool.KnowledgeCatalogPayload;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    private final MultiAgentQaOrchestrator orchestrator;
    private final KnowledgeSearchTool knowledgeSearchTool;
    private final AsyncTaskExecutor assistantStreamExecutor;
    private final AssistantRuntimeStatusService runtimeStatusService;

    public AssistantController(MultiAgentQaOrchestrator orchestrator, KnowledgeSearchTool knowledgeSearchTool,
            AsyncTaskExecutor assistantStreamExecutor, AssistantRuntimeStatusService runtimeStatusService) {
        this.orchestrator = orchestrator;
        this.knowledgeSearchTool = knowledgeSearchTool;
        this.assistantStreamExecutor = assistantStreamExecutor;
        this.runtimeStatusService = runtimeStatusService;
    }

    @PostMapping("/ask")
    public AgentResponse ask(@Valid @RequestBody AgentRequest request) {
        return this.orchestrator.answer(request);
    }

    @PostMapping(path = "/ask/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter askStream(@Valid @RequestBody AgentRequest request) {
        SseEmitter emitter = new SseEmitter(0L);
        this.assistantStreamExecutor.execute(() -> {
            try {
                this.orchestrator.answer(request, new StreamingExecutionListener(emitter));
                emitter.complete();
            }
            catch (Exception exception) {
                emitter.complete();
            }
        });
        return emitter;
    }

    @GetMapping("/catalog")
    public KnowledgeCatalogPayload catalog() {
        return this.knowledgeSearchTool.catalog();
    }

    private void sendEvent(SseEmitter emitter, String eventName, AgentStreamEvent payload) throws IOException {
        emitter.send(SseEmitter.event().name(eventName).data(payload));
    }

    private final class StreamingExecutionListener implements AgentExecutionListener {

        private final SseEmitter emitter;

        private StreamingExecutionListener(SseEmitter emitter) {
            this.emitter = emitter;
        }

        @Override
        public void onSessionStarted(AgentContext context) {
            try {
                sendEvent(this.emitter, "session", new AgentStreamEvent(
                        "session",
                        context.conversationId(),
                        context.traceId(),
                        null,
                        null,
                        "started",
                        runtimeStatusService.currentStatus().code(),
                        "已建立新的执行会话。",
                        runtimeStatusService.currentStatus(),
                        null
                ));
            }
            catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        @Override
        public void onStageStarted(String stageKey, String stageLabel, String message, String severity) {
            try {
                sendEvent(this.emitter, "stage", new AgentStreamEvent(
                        "stage",
                        null,
                        null,
                        stageKey,
                        stageLabel,
                        "started",
                        severity,
                        message,
                        null,
                        null
                ));
            }
            catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        @Override
        public void onStageCompleted(String stageKey, String stageLabel, String message, long latencyMs, String severity) {
            try {
                sendEvent(this.emitter, "stage", new AgentStreamEvent(
                        "stage",
                        null,
                        null,
                        stageKey,
                        stageLabel,
                        "completed",
                        severity,
                        message + "（" + latencyMs + "ms）",
                        null,
                        null
                ));
            }
            catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        @Override
        public void onCompleted(AgentResponse response) {
            try {
                sendEvent(this.emitter, "done", new AgentStreamEvent(
                        "done",
                        response.conversationId(),
                        response.traceId(),
                        null,
                        null,
                        "completed",
                        runtimeStatusService.currentStatus().code(),
                        "回答已生成。",
                        runtimeStatusService.currentStatus(),
                        response
                ));
            }
            catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        @Override
        public void onError(String stageKey, String stageLabel, String message, Throwable error, String severity) {
            try {
                sendEvent(this.emitter, "error", new AgentStreamEvent(
                        "error",
                        null,
                        null,
                        stageKey,
                        stageLabel,
                        "error",
                        severity,
                        message,
                        runtimeStatusService.currentStatus(),
                        null
                ));
            }
            catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }
    }
}

