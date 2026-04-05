package com.example.springaidemo.infra.memory;

import com.example.springaidemo.application.memory.ConversationMemory;
import com.example.springaidemo.domain.memory.ConversationTurn;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import org.springframework.stereotype.Component;

@Component
public class InMemoryConversationMemory implements ConversationMemory {

    private static final int WINDOW_SIZE = 8;
    private final Map<String, Deque<ConversationTurn>> turnsByConversation = new ConcurrentHashMap<>();

    @Override
    public List<ConversationTurn> recentTurns(String conversationId) {
        if (conversationId == null) {
            return List.of();
        }
        Deque<ConversationTurn> turns = this.turnsByConversation.get(conversationId);
        if (turns == null) {
            return List.of();
        }
        return List.copyOf(new ArrayList<>(turns));
    }

    @Override
    public void appendExchange(String conversationId, String userMessage, String assistantMessage) {
        Deque<ConversationTurn> turns = this.turnsByConversation.computeIfAbsent(
                conversationId,
                ignored -> new ConcurrentLinkedDeque<>()
        );
        turns.addLast(new ConversationTurn("user", userMessage, Instant.now()));
        turns.addLast(new ConversationTurn("assistant", assistantMessage, Instant.now()));
        while (turns.size() > WINDOW_SIZE) {
            turns.pollFirst();
        }
    }
}
