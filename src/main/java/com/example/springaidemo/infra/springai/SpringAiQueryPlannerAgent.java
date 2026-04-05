package com.example.springaidemo.infra.springai;

import com.example.springaidemo.application.agent.QueryPlannerAgent;
import com.example.springaidemo.application.orchestrator.StructuredJsonParser;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.QueryPlan;
import com.example.springaidemo.domain.memory.ConversationTurn;
import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.template.NoOpTemplateRenderer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "openai")
public class SpringAiQueryPlannerAgent implements QueryPlannerAgent {

    private static final String SYSTEM_PROMPT = """
            You are the planner agent in a multi-agent knowledge base assistant.
            Decide whether the answer should come from knowledge search or direct conversation.
            Return JSON only.
            Required fields:
            - route: KB_LOOKUP or DIRECT_REPLY
            - normalizedQuestion: concise rewritten user intent
            - retrievalQuery: search-oriented phrase for the vector store
            - answerLanguage: language tag such as zh-CN or en-US
            - focusPoints: array of short bullets
            Rules:
            - Prefer KB_LOOKUP for factual, support, policy, release, troubleshooting, or process questions.
            - Prefer DIRECT_REPLY only for greetings, gratitude, or short conversational turns.
            - Keep retrievalQuery short and information dense.
            - Match answerLanguage to the user message.
            """;

    private final ChatClient chatClient;
    private final StructuredJsonParser parser;

    public SpringAiQueryPlannerAgent(ChatClient.Builder builder, StructuredJsonParser parser) {
        this.chatClient = builder
                .defaultTemplateRenderer(new NoOpTemplateRenderer())
                .defaultSystem(SYSTEM_PROMPT)
                .build();
        this.parser = parser;
    }

    @Override
    public QueryPlan plan(AgentRequest request, AgentContext context) {
        String content = this.chatClient.prompt()
                .user(buildUserPrompt(request, context))
                .call()
                .content();
        try {
            QueryPlan plan = this.parser.parse(content, QueryPlan.class);
            return sanitize(plan, request.question());
        }
        catch (Exception ignored) {
            return fallback(request.question());
        }
    }

    private QueryPlan sanitize(QueryPlan plan, String question) {
        String normalizedQuestion = hasText(plan.normalizedQuestion()) ? plan.normalizedQuestion().trim() : question.trim();
        String retrievalQuery = hasText(plan.retrievalQuery()) ? plan.retrievalQuery().trim() : normalizedQuestion;
        String answerLanguage = hasText(plan.answerLanguage()) ? plan.answerLanguage().trim() : detectLanguage(question);
        List<String> focusPoints = plan.focusPoints() == null || plan.focusPoints().isEmpty()
                ? List.of("Ground the answer in retrieved knowledge.")
                : plan.focusPoints();
        String route = hasText(plan.route()) ? plan.route().trim().toUpperCase() : "KB_LOOKUP";
        return new QueryPlan(route, normalizedQuestion, retrievalQuery, answerLanguage, focusPoints);
    }

    private QueryPlan fallback(String question) {
        return new QueryPlan(
                "KB_LOOKUP",
                question.trim(),
                question.trim(),
                detectLanguage(question),
                List.of("Answer with grounded citations.")
        );
    }

    private String buildUserPrompt(AgentRequest request, AgentContext context) {
        return "Recent conversation:\n" + formatHistory(context.recentTurns()) + "\n\nLatest question:\n" + request.question();
    }

    private String formatHistory(List<ConversationTurn> turns) {
        if (turns == null || turns.isEmpty()) {
            return "No prior context.";
        }
        StringBuilder builder = new StringBuilder();
        for (ConversationTurn turn : turns) {
            builder.append("- ")
                    .append(turn.role())
                    .append(": ")
                    .append(turn.content())
                    .append(System.lineSeparator());
        }
        return builder.toString().trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
