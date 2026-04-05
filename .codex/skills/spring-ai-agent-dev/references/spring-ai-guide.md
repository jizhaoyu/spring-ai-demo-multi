# Spring AI Guide

## 1. When to Use

Use Spring AI when the project is Spring Boot first and you want:

- Spring-native integration
- advisor chains for policy, memory, and retrieval
- Actuator-backed observability
- explicit tool boundaries in a Spring application

If the task is still framework-neutral, use `java-agent-dev` first.

## 2. Core Design

Use a narrow runtime chain:

`Controller -> ChatClient -> Advisors -> ChatModel -> Tool/RAG -> Memory -> Audit -> Response`

Keep these responsibilities separated:

- `ChatClient`: request boundary
- advisors: memory, retrieval, policy, request shaping, logging
- model client: provider integration only
- tool layer: server-side validation and execution
- memory layer: conversation state and summaries
- audit layer: trace, token, tool, and error records

## 3. Spring AI-Specific Patterns

### Advisors

- Register advisors in a fixed order.
- Treat advisor order as part of the contract.
- Keep policy and redaction advisors early in the chain.
- Keep logging and observability advisors deterministic.

Spring AI advisor execution participates in observability, so do not let order drift silently.

### Chat Memory

- Use conversation IDs explicitly.
- Keep tool intermediates out of long-term memory unless retention is intentional.
- Separate session memory from durable summaries.
- Treat memory contents as model input, not as trusted truth.

### Tool Calling

- Register only whitelisted tools.
- Wrap every tool with permission and audit checks.
- Do not expose internal repositories or mappers directly.
- Treat tool input and output as untrusted until validated.

### Structured Output

- Parse model output into Java types.
- Validate parsed objects with JSR-303 and business rules.
- Fail closed if the structure or enum values are invalid.

### RAG

- Keep retrieval source IDs and citations explicit.
- Limit retrieved content before injecting it into the prompt.
- Add empty-retrieval fallback behavior.
- Do not allow retrieved text to override system rules.

### Observability

- Enable Actuator for production-ready services.
- Default to excluding prompt/input content from exported telemetry.
- Log only the minimum necessary content.
- Correlate model calls, advisor execution, tool calls, and retries with trace IDs.

## 4. Enterprise Rules

- Tenant isolation is mandatory in request, memory, cache, retrieval, and tools.
- Human approval is required for high-risk actions such as delete, payment, approval, bulk mutation, or external side effects.
- Audit records must include request, model, tool, latency, and failure metadata.
- Prompt injection defenses must treat RAG content and tool output as untrusted input.

## 5. Minimum Code Shape

```java
ChatClient chatClient = ChatClient.builder(chatModel)
        .defaultAdvisors(
                policyAdvisor,
                messageMemoryAdvisor,
                retrievalAdvisor,
                auditAdvisor
        )
        .build();
```

```java
String answer = chatClient.prompt()
        .user(userInput)
        .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
        .call()
        .content();
```

## 6. Validation

- unit test advisor ordering and policy behavior
- unit test structured-output parsing and validation
- integration test memory and retrieval boundaries
- scenario test empty retrieval, tool failure, and approval denial
- regression test prompt and model changes against a golden set

## 7. What Not To Do

- Do not let the model decide tool permission.
- Do not rely on prompt text for tenant isolation.
- Do not keep prompt/input telemetry enabled by default.
- Do not store tool intermediates or PII without an explicit retention decision.
