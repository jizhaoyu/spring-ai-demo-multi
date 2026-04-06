package com.example.springaidemo.infra.springai;

import com.example.springaidemo.application.agent.ResponseComposerAgent;
import com.example.springaidemo.application.orchestrator.StructuredJsonParser;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.AnswerDraft;
import com.example.springaidemo.domain.agent.QueryPlan;
import com.example.springaidemo.domain.agent.ResearchBrief;
import com.example.springaidemo.domain.memory.ConversationTurn;
import com.example.springaidemo.domain.tool.Citation;
import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.template.NoOpTemplateRenderer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "openai")
public class SpringAiResponseComposerAgent implements ResponseComposerAgent {

    private static final String SYSTEM_PROMPT = """
            You are the response agent in a multi-agent knowledge base assistant.
            Produce the final user-facing answer.
            Return JSON only.
            Required fields:
            - answer: polished final response
            - confidence: HIGH, MEDIUM, or LOW
            - followUpQuestions: array with up to three useful follow-up suggestions
            Rules:
            - Match the requested answer language.
            - Use only the research brief and evidence titles supplied in the prompt.
            - If supportLevel is UNSUPPORTED, be transparent that the knowledge base lacks enough evidence.
            - When evidence exists, cite source titles inline using plain text like Source: Support Policies.
            """;

    private final ChatClient chatClient;
    private final StructuredJsonParser parser;

    public SpringAiResponseComposerAgent(ChatClient.Builder builder, StructuredJsonParser parser) {
        this.chatClient = builder
                .defaultTemplateRenderer(new NoOpTemplateRenderer())
                .defaultSystem(SYSTEM_PROMPT)
                .build();
        this.parser = parser;
    }

    @Override
    public AnswerDraft answer(AgentRequest request, AgentContext context, QueryPlan plan, ResearchBrief researchBrief,
            List<Citation> citations) {
        String content = this.chatClient.prompt()
                .user(buildPrompt(request, context, plan, researchBrief, citations))
                .call()
                .content();
        try {
            AnswerDraft draft = this.parser.parse(content, AnswerDraft.class);
            return sanitize(draft, researchBrief);
        }
        catch (Exception ignored) {
            return fallback(researchBrief, citations);
        }
    }

    private AnswerDraft sanitize(AnswerDraft draft, ResearchBrief researchBrief) {
        List<String> followUps = draft.followUpQuestions() == null ? List.of() : draft.followUpQuestions();
        List<String> recoveryActions = draft.recoveryActions() == null ? List.of() : draft.recoveryActions();
        String confidence = draft.confidence() == null
                ? mapConfidence(researchBrief.supportLevel())
                : draft.confidence().trim().toUpperCase();
        return new AnswerDraft(draft.answer(), confidence, followUps, recoveryActions);
    }

    private AnswerDraft fallback(ResearchBrief researchBrief, List<Citation> citations) {
        String sourceLead = citations.isEmpty() ? "" : " Source: " + citations.get(0).title() + ".";
        String answer = researchBrief.executiveSummary() + sourceLead;
        return new AnswerDraft(answer, mapConfidence(researchBrief.supportLevel()), List.of(), List.of());
    }

    private String mapConfidence(String supportLevel) {
        return switch (supportLevel == null ? "PARTIAL" : supportLevel.toUpperCase()) {
            case "SUPPORTED" -> "HIGH";
            case "UNSUPPORTED" -> "LOW";
            default -> "MEDIUM";
        };
    }

    private String buildPrompt(AgentRequest request, AgentContext context, QueryPlan plan, ResearchBrief researchBrief,
            List<Citation> citations) {
        return "Answer language: " + plan.answerLanguage()
                + "\n\nRecent conversation:\n" + formatHistory(context.recentTurns())
                + "\n\nLatest question:\n" + request.question()
                + "\n\nResearch brief:\nSupport level: " + researchBrief.supportLevel()
                + "\nSummary: " + researchBrief.executiveSummary()
                + "\nKey findings: " + String.join("; ", researchBrief.keyFindings())
                + "\nGaps: " + String.join("; ", researchBrief.gaps())
                + "\nAnswer outline: " + String.join("; ", researchBrief.answerOutline())
                + "\n\nAvailable sources:\n" + formatSources(citations);
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

    private String formatSources(List<Citation> citations) {
        if (citations == null || citations.isEmpty()) {
            return "No grounded sources were available.";
        }
        StringBuilder builder = new StringBuilder();
        for (Citation citation : citations) {
            builder.append("- ")
                    .append(citation.title())
                    .append(" [")
                    .append(citation.sourceId())
                    .append("] ")
                    .append(citation.excerpt())
                    .append(System.lineSeparator());
        }
        return builder.toString().trim();
    }
}
