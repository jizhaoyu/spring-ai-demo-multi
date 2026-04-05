package com.example.springaidemo.application.agent;

import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.QueryPlan;

public interface QueryPlannerAgent {

    QueryPlan plan(AgentRequest request, AgentContext context);
}
