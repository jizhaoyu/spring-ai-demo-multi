package com.example.springaidemo.application.runtime;

import com.example.springaidemo.domain.tool.RuntimeStatus;
import com.example.springaidemo.infra.retrieval.KnowledgeBaseIndexer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AssistantRuntimeStatusService {

    private final KnowledgeBaseIndexer knowledgeBaseIndexer;
    private final String chatModelMode;

    public AssistantRuntimeStatusService(KnowledgeBaseIndexer knowledgeBaseIndexer,
            @Value("${spring.ai.model.chat:none}") String chatModelMode) {
        this.knowledgeBaseIndexer = knowledgeBaseIndexer;
        this.chatModelMode = chatModelMode;
    }

    public RuntimeStatus currentStatus() {
        RuntimeStatus baseStatus = this.knowledgeBaseIndexer.baseStatus();
        if (!this.knowledgeBaseIndexer.hasSearchableContent()) {
            return RuntimeStatus.offline(baseStatus.message());
        }
        if (!isModelEnhancedMode()) {
            return RuntimeStatus.degraded("当前使用本地降级链路回答问题，知识库浏览与证据检索仍可用。");
        }
        return RuntimeStatus.normal("当前使用模型增强问答链路，知识库检索已就绪。");
    }

    public boolean isModelEnhancedMode() {
        return "openai".equalsIgnoreCase(this.chatModelMode);
    }
}
