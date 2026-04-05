package com.example.springaidemo.application.memory;

import com.example.springaidemo.domain.memory.ConversationTurn;
import java.util.List;

public interface ConversationMemory {

    List<ConversationTurn> recentTurns(String conversationId);

    void appendExchange(String conversationId, String userMessage, String assistantMessage);
}
