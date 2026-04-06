package com.example.springaidemo.infra.fallback;

import com.example.springaidemo.application.agent.ResponseComposerAgent;
import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.agent.AgentRequest;
import com.example.springaidemo.domain.agent.AnswerDraft;
import com.example.springaidemo.domain.agent.QueryPlan;
import com.example.springaidemo.domain.agent.ResearchBrief;
import com.example.springaidemo.domain.tool.Citation;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "none", matchIfMissing = true)
public class LocalFallbackResponseComposerAgent implements ResponseComposerAgent {

    @Override
    public AnswerDraft answer(AgentRequest request, AgentContext context, QueryPlan plan, ResearchBrief researchBrief,
            List<Citation> citations) {
        String answer;
        if (citations == null || citations.isEmpty()) {
            answer = "当前知识库暂时无法为这个问题提供可靠依据。你可以补充相关文档，或者换一个更具体的问题继续提问。";
            return new AnswerDraft(
                    answer,
                    "LOW",
                    List.of("要不要先查看现有知识库目录？"),
                    List.of("缩小问题范围后重试", "先选择一份文档，再重新提问", "更换关键词后继续追问")
            );
        }

        String sourceNames = citations.stream().map(Citation::title).distinct().collect(Collectors.joining("、"));
        answer = researchBrief.executiveSummary() + "\n\n参考来源：" + sourceNames + "。";
        return new AnswerDraft(
                answer,
                "MEDIUM",
                List.of("是否需要我继续展开某一条来源的细节？"),
                List.of("打开验证工作台核对证据", "如需更准，先限定一份文档后追问")
        );
    }
}


