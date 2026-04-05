package com.example.springaidemo.application.agent;

import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.AnswerDraft;
import com.example.springaidemo.domain.agent.QueryPlan;
import com.example.springaidemo.domain.agent.ResearchBrief;
import com.example.springaidemo.domain.tool.Citation;
import java.util.List;

public interface ResponseComposerAgent {

    AnswerDraft answer(AgentRequest request, AgentContext context, QueryPlan plan, ResearchBrief researchBrief,
            List<Citation> citations);
}
