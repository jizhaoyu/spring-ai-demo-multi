package com.example.springaidemo.application.orchestrator;

import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentResponse;

public interface AgentExecutionListener {

    AgentExecutionListener NO_OP = new AgentExecutionListener() {
    };

    default void onSessionStarted(AgentContext context) {
    }

    default void onStageStarted(String stageKey, String stageLabel, String message, String severity) {
    }

    default void onStageCompleted(String stageKey, String stageLabel, String message, long latencyMs, String severity) {
    }

    default void onCompleted(AgentResponse response) {
    }

    default void onError(String stageKey, String stageLabel, String message, Throwable error, String severity) {
    }
}
