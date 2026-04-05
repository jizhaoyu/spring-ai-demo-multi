# Spring AI Enterprise Agent Guide

## Scope

Use this guide when building or reviewing enterprise Java agent systems on top of Spring AI.
It assumes `Spring Boot 3.x` and a service-oriented application boundary.

## 1. When to choose Spring AI

Choose Spring AI when:

- the application is already Spring Boot based
- configuration, dependency injection, and environment wiring should stay idiomatic to Spring
- agent behavior needs to integrate with existing service, repository, scheduler, security, and actuator layers
- you want Spring-native observability, configuration, and deployment patterns

Do not choose Spring AI only because the project uses Spring. If the main problem is experimentation with many LLM abstractions and minimal framework lock-in, evaluate alternatives separately.

## 2. Recommended route selection

| Route | Use when | Minimum required modules |
| --- | --- | --- |
| `single-agent chat` | FAQ, summarization, assistant endpoints | controller, orchestrator, prompt assembly, ChatClient, audit |
| `tool-calling agent` | querying or acting on business systems | all of the above plus tool registry, permission guard, tool audit |
| `RAG agent` | knowledge-grounded answers | all of the above plus retrieval service, document chunk repository, citation assembler |
| `workflow-backed agent` | approvals, task progression, background jobs | all of the above plus workflow state machine, task repository, scheduler, human approval gateway |

## 3. Spring AI request chain

Make the call path explicit in design docs and code reviews:

`Controller -> Orchestrator -> Advisor/Prompt assembly -> ChatClient -> Tool/RAG -> Memory -> Audit -> Response`

Recommended responsibility split:

- `Controller`: HTTP boundary, authn/authz, input validation, response shape
- `Orchestrator`: one use case, one execution path, no framework-heavy config
- `Advisor assembly`: conversation memory, system constraints, request-scoped augmentation
- `ChatClient`: model invocation and structured response handling
- `Tool layer`: tool selection boundary, permission checks, execution, audit
- `Retrieval layer`: retrieval, reranking if present, citation shaping
- `Audit layer`: trace, latency, model metadata, tool calls, errors

## 4. Spring AI-specific implementation notes

### 4.1 ChatClient

Use `ChatClient` as the invocation facade, not as the home for business logic.
Spring AI documents `ChatClient` as the fluent API for prompt construction and model calls, and shows multiple-client patterns when more than one model is needed.
Keep model options, prompt composition, and business orchestration outside of controllers.

### 4.2 Advisors

Use advisors for request-scoped augmentation, memory, and cross-cutting model input shaping.
Do not hide core business decisions inside advisor chains where they become hard to test.
Document advisor order when the sequence materially changes outputs.

### 4.3 Chat memory

Treat chat memory as a bounded context store, not a raw transcript dump.
Store summaries or selected turns when needed.
Do not rely on memory to enforce authorization or tenant boundaries.

### 4.4 Tool calling

Expose tools as explicit Spring-managed boundaries with validation, timeout handling, and audit.
Do not treat arbitrary service methods as model-callable tools.
Every tool should have:

- clear name and description
- typed input contract
- typed or consistently structured output contract
- permission checks
- timeout and failure classification
- audit emission

### 4.5 Structured output

Prefer mapping outputs into explicit Java response types for downstream reliability.
Use structured output where the response will feed workflows, persistence, or tools.
Do not accept loosely formatted natural language when later steps require deterministic parsing.

### 4.6 RAG

Keep retrieval separate from response generation.
At minimum define:

- chunking strategy
- metadata strategy
- retrieval filter policy
- empty-result fallback
- citation formatting
- refresh/update path

### 4.7 Framework-specific caveats verified against official docs

- Spring AI recommends registering advisors at build time with `defaultAdvisors()` when they are part of the normal execution path.
- `MessageChatMemoryAdvisor`, `PromptChatMemoryAdvisor`, and `VectorStoreChatMemoryAdvisor` have different prompt-shaping tradeoffs. Choose deliberately instead of treating them as equivalent.
- Current Spring AI chat memory documentation notes that intermediate tool-call messages are not stored automatically in memory during tool execution. If those steps matter for traceability or replay, persist them yourself.
- Spring AI supports structured mapping through `entity(...)`, `BeanOutputConverter`, and related converters. Keep a fallback converter path for providers that do not fully support native structured output.
- Spring AI observability covers `ChatClient`, `Advisor`, `ChatModel`, `EmbeddingModel`, and `VectorStore`. Keep tracing aligned with that model rather than inventing separate ad hoc identifiers.


## 5. Recommended package shape

```text
com.company.agentapp
├─ config
├─ controller
├─ application
│  ├─ orchestrator
│  ├─ workflow
│  └─ task
├─ domain
│  ├─ agent
│  ├─ tool
│  ├─ memory
│  └─ prompt
├─ infra
│  ├─ springai
│  ├─ retrieval
│  ├─ persistence
│  └─ audit
└─ common
```

## 6. Minimum contracts

Define these explicitly:

- `AgentRequest`
- `AgentContext`
- `ToolDefinition`
- `ToolCall`
- `ToolResult`
- `AgentResponse`
- `AuditLog`

Example tool boundary:

```java
public interface AgentTool<I, O> {
    String getName();
    String getDescription();
    Class<I> getInputType();
    O execute(I input, ToolExecutionContext context);
}
```

## 7. Governance baseline

These are non-negotiable:

- never delegate final tool permission to the model
- enforce tenant isolation in service and repository boundaries
- redact sensitive input/output before logging
- require human approval for destructive, monetary, or authorization-changing actions
- treat prompt injection as an input risk, not just a prompt-writing concern

Suggested audit fields:

- `traceId`
- `sessionId`
- `tenantId`
- `userId`
- `model`
- `toolName`
- `latencyMs`
- `promptTokens`
- `completionTokens`
- `errorCode`
- `riskLevel`

## 8. Observability

Use Spring-native observability where possible.
Track at least:

- request latency
- model latency
- tool latency
- retrieval latency
- tool error rate
- empty retrieval rate
- approval wait time
- token usage

If the application uses tracing, carry a request trace id through model and tool execution logs.

## 9. Testing matrix

| Level | Focus |
| --- | --- |
| unit | advisor assembly, prompt shaping, parser logic, guards |
| integration | model client, retrieval, repositories, tools |
| scenario | business flows, tool success/failure, empty retrieval, fallback |
| regression | prompt changes, model changes, advisor order changes, tool contract changes |

Maintain a small golden set for:

- normal requests
- edge requests
- retrieval misses
- tool failures
- approval-required flows

## 10. Codex usage patterns

Use prompts like:

```text
Use $spring-ai-agent-dev to design a Spring Boot tool-calling agent with strict permission guards, audit logging, and structured output.
```

```text
Use $spring-ai-agent-dev to review this Spring AI module for advisor boundaries, memory handling, retrieval shape, and enterprise governance gaps.
```

## 11. Official references

- Spring AI reference index: https://docs.spring.io/spring-ai/reference/
- ChatClient API: https://docs.spring.io/spring-ai/reference/api/chatclient.html
- Advisors API: https://docs.spring.io/spring-ai/reference/api/advisors.html
- Chat memory: https://docs.spring.io/spring-ai/reference/api/chat-memory.html
- Tool calling: https://docs.spring.io/spring-ai/reference/api/tools.html
- Structured output: https://docs.spring.io/spring-ai/reference/api/structured-output-converter.html
- Observability: https://docs.spring.io/spring-ai/reference/observability/
