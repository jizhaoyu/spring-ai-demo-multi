---
name: spring-ai-agent-dev
description: Design, scaffold, implement, review, or refine Spring AI based Java agent systems. Use when Codex needs to build Spring Boot agents with advisors, chat memory, tool calling, RAG, structured output, observability, governance controls, audit logging, testing strategy, or enterprise delivery constraints.
---

# Spring AI Agent Dev

## Overview

Use this skill for Spring Boot agent work that should stay inside the Spring ecosystem.
Use `java-agent-dev` first if the task is still framework-agnostic or if the route has not been chosen yet.
Load `references/spring-ai-guide.md` for the concise framework playbook.
Load `references/spring-ai-enterprise-guide.md` for deeper enterprise patterns, governance, observability, and testing detail.

## Workflow

### 1. Confirm the route

Classify the task first:

- `PoC / single-agent`
- `RAG agent`
- `tool-calling agent`
- `workflow agent`
- `multi-agent`

Prefer `spring-ai-agent-dev` when:

- the codebase is Spring Boot first
- you need advisors, Actuator observability, or Spring bean integration
- you want a Spring-native ChatClient / memory / tool / RAG stack

If the route is still unclear, use `java-agent-dev` to decide the architecture before writing framework-specific code.

### 2. Keep the Spring AI runtime chain explicit

Always describe the request path as:

`Controller -> ChatClient -> Advisors -> ChatModel -> Tool/RAG -> Memory -> Observability/Audit -> Response`

If the task is workflow-based, add lifecycle states such as:

- `CREATED`
- `RUNNING`
- `WAITING_TOOL`
- `WAITING_APPROVAL`
- `RETRYING`
- `FAILED`
- `COMPLETED`

### 3. Use Spring AI building blocks deliberately

Prefer these defaults:

- `ChatClient` as the main orchestration boundary
- advisors for memory, retrieval, policy, and request shaping
- explicit tool registration and server-side tool guards
- structured output with validation after model parsing
- Actuator-backed observability from the first production-ready version

Keep the architecture as small as possible:

- request entrypoint
- chat client orchestration
- advisor chain
- model client
- memory store
- retrieval layer when needed
- tool wrapper/registry when needed
- audit/observability

### 4. Define concrete contracts

At minimum, define or review these contracts:

- `AgentRequest`
- `AgentContext`
- `ToolDefinition`
- `ToolCall`
- `ToolResult`
- `AgentResponse`
- `AuditLog`

Avoid loose `Map<String, Object>` payloads unless the task explicitly requires dynamic schemas.

### 5. Enforce governance rules

These rules are mandatory:

- Tool permission must never be delegated to the model alone.
- High-risk actions must not execute without server-side policy checks, and often require human approval.
- Audit logging and sensitive-data redaction must exist from the first production-capable version.
- Tenant isolation must be enforced in service code, not implied by prompts.
- Prompt injection defenses belong in the system design, not only in prompt wording.

### 6. Validate before completion

Include validation as part of the design:

- unit tests for advisors, memory, tool guards, and output parsing
- integration tests for model, retrieval, tool, and persistence boundaries
- scenario tests for real user tasks
- regression tests or golden sets for prompt/model/tool changes

For production-facing work, always mention:

- failure modes
- fallback behavior
- auditability
- approval gates
- tenant/scope boundaries

## Deliverables

When this skill is used for planning or implementation, prefer producing:

- chosen route and why
- Spring AI specific architecture
- package/module structure
- advisor chain design
- memory and tool boundaries
- governance rules
- testing and rollout checklist

## Reference

Read `references/spring-ai-guide.md` when you need:

- Spring AI route selection detail
- advisor ordering and memory patterns
- structured output and tool-calling patterns
- RAG and observability guidance
- test matrix and rollout checklist

Read `references/spring-ai-enterprise-guide.md` when you need:

- package and module structure for production services
- framework-specific caveats verified against official docs
- audit, tenant, approval, and redaction baselines
- code-shape examples for tool boundaries and runtime flow
