package com.example.springaidemo.infra.fallback;

import com.example.springaidemo.application.agent.QueryPlannerAgent;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.QueryPlan;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "none", matchIfMissing = true)
public class LocalFallbackQueryPlannerAgent implements QueryPlannerAgent {

    @Override
    public QueryPlan plan(AgentRequest request, AgentContext context) {
        String question = request.question().trim();
        boolean directReply = isDirectReply(question);
        return new QueryPlan(
                directReply ? "DIRECT_REPLY" : "KB_LOOKUP",
                question,
                question,
                detectLanguage(question),
                List.of(directReply ? "直接回复用户的简单对话。" : "优先基于知识库证据生成回答。")
        );
    }

    private boolean isDirectReply(String question) {
        String normalized = question.toLowerCase();
        return normalized.matches("^(hi|hello|thanks|thank you|你好|您好|谢谢|在吗)[!！?？ ]*$");
    }

    private String detectLanguage(String question) {
        for (char current : question.toCharArray()) {
            if (current >= 0x4E00 && current <= 0x9FFF) {
                return "zh-CN";
            }
        }
        return "en-US";
    }
}


