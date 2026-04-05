package com.example.springaidemo.infra.fallback;

import com.example.springaidemo.application.agent.ResearchAgent;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.QueryPlan;
import com.example.springaidemo.domain.agent.ResearchBrief;
import com.example.springaidemo.domain.tool.Citation;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "none", matchIfMissing = true)
public class LocalFallbackResearchAgent implements ResearchAgent {

    @Override
    public ResearchBrief research(AgentRequest request, AgentContext context, QueryPlan plan, List<Citation> citations) {
        if (citations == null || citations.isEmpty()) {
            return new ResearchBrief(
                    "UNSUPPORTED",
                    "当前知识库中没有找到与问题直接相关的证据。",
                    List.of("暂无可引用的知识片段支持本次回答。"),
                    List.of("请补充知识文档，或换一个更具体的问题再试。"),
                    List.of("明确告诉用户当前回答缺少知识库依据。")
            );
        }

        return new ResearchBrief(
                "SUPPORTED",
                "已从知识库中提取到可以支持回答的证据。",
                citations.stream().map(Citation::excerpt).limit(3).toList(),
                List.of(),
                List.of("先概括核心结论。", "补充来源名称，保证回答可追溯。")
        );
    }
}


