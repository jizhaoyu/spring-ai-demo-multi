package com.example.springaidemo.application.tool;

import com.example.springaidemo.domain.agent.AgentContext;
import com.example.springaidemo.domain.tool.KnowledgeCatalogPayload;
import com.example.springaidemo.domain.tool.KnowledgeSearchResult;

public interface KnowledgeSearchTool {

    KnowledgeSearchResult search(String query, AgentContext context);

    KnowledgeCatalogPayload catalog();
}
