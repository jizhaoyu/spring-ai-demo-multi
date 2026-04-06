# AI 知识库问答控制台 UI/UX 实施计划 Contract v1

## 0. Context

- 本计划用于把 `docs/ai-console-ui-ux-implementation-plan.md` 的策略方案压成 `/auto` 可直接执行的任务合同。
- 实施重点是首问效率、证据验证效率和移动端优先顺序，且不能破坏现有 Spring AI 多阶段问答、fallback 降级链路和知识库目录树。
- 本计划默认继续使用 `HTML + CSS + Vanilla JS + Maven Wrapper`，不新增前端框架或第三方依赖。

## 1. Strategy

- 先完成只涉及静态前端和前端测试的 Phase 1，再推进验证工作台与后端透明度字段扩展，最后处理布局预设和移动端深化。
- 每张卡都从最小失败测试或最小复现步骤开始，避免 `/auto` 只拿到方向性分析却没有可执行入口。
- 涉及响应契约扩展时，必须保护 `MultiAgentQaOrchestrator` 的本地 fallback 路径，确保“无模型配置”场景仍能问答。

## Execution Cards

## CARD A-01: Rebuild the first-screen ask bar and contextual guide

### Type
code

### Goal

- 把问答输入区重构成首屏主操作位，交付粘性 `Ask Bar`、紧凑运行状态条和按状态出现的引导区。
- 让用户进入页面后无需滚动即可看到输入框、发送按钮和当前文档范围摘要。

### Scope

- `src/main/resources/static/index.html`
- `src/main/resources/static/styles.css`
- `src/main/resources/static/app.js`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `StaticConsoleUiTest.indexHtmlExposesBusinessFriendlyContextAndDetailShells()` 中加入 `id="askBar"`、`id="askBarStatus"`、`id="contextualGuide"`、`id="exampleQuestionRail"` 的断言。
- 运行 `.\\mvnw.cmd -Dtest=StaticConsoleUiTest test`，确认新增断言先失败。
- 实现后启动 `.\\mvnw.cmd spring-boot:run`，在 1440px 视口下验证输入框、发送按钮和当前文档范围摘要都位于首屏。

### Done When

- `Quick Start` 仅在空会话、低置信度回答或长时间未输入时出现。
- 顶部状态区压缩为单条运行摘要。
- 示例问题退到次级入口，不再与首问动作竞争。

## CARD A-02: Add workset navigation and a mobile document drawer

### Type
code

### Goal

- 为文档树增加最近使用、固定文档和常用文档工作集。
- 在小屏幕下把文档树切换为抽屉式范围选择，避免阻塞首次提问。

### Scope

- `src/main/resources/static/index.html`
- `src/main/resources/static/styles.css`
- `src/main/resources/static/app.js`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `StaticConsoleUiTest.indexHtmlExposesBusinessFriendlyContextAndDetailShells()` 中加入 `id="worksetTabs"`、`id="recentDocsList"`、`id="pinnedDocsList"`、`id="docDrawerToggle"`、`id="docDrawer"` 的断言。
- 再在 `StaticConsoleUiTest.appScriptWiresRuntimeSummaryAndMobileDetailInteractions()` 中加入 `RECENT_DOCS_STORAGE_KEY`、`PINNED_DOCS_STORAGE_KEY`、`toggleDocDrawer`、`renderWorksets` 的断言。
- 运行 `.\\mvnw.cmd -Dtest=StaticConsoleUiTest test`，确认测试先失败；实现后在手机视口下验证文档树默认收起、选中文档后刷新仍保留最近使用记录。

### Done When

- 高频文档可在 2 次点击内加入工作集。
- 工作集状态可本地恢复。
- 移动端优先显示输入区，文档范围通过抽屉按需打开。

## CARD A-03: Ship keyboard shortcuts and multi-format evidence copy actions

### Type
code

### Goal

- 交付快捷键帮助面板、文档搜索快捷入口、证据三种复制模式和消息上下文操作。
- 让熟练用户能够通过键盘快速切换问答、证据、轨迹并复制证据。

### Scope

- `src/main/resources/static/index.html`
- `src/main/resources/static/styles.css`
- `src/main/resources/static/app.js`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `StaticConsoleUiTest.indexHtmlExposesBusinessFriendlyContextAndDetailShells()` 中加入 `id="shortcutHelpDialog"`、`id="messageActionMenu"`、`id="evidenceCopyMenu"` 的断言。
- 再在 `StaticConsoleUiTest.appScriptWiresRuntimeSummaryAndMobileDetailInteractions()` 中加入 `handleGlobalShortcut`、`openShortcutHelp`、`copyEvidenceAs('plain')`、`copyEvidenceAs('source')`、`copyEvidenceAs('markdown')` 的断言。
- 运行 `.\\mvnw.cmd -Dtest=StaticConsoleUiTest test`，确认测试先失败；实现后手动验证 `?`、`Ctrl/Cmd+K`、`Alt+1/2/3`、`Ctrl/Cmd+Shift+C`。

### Done When

- 核心区域都可以通过键盘到达。
- 证据复制可输出纯文本、带来源和 Markdown。
- 新快捷键不覆盖浏览器常见默认快捷键。

## CARD A-04: Add accessibility foundations and local static asset loading

### Type
code

### Goal

- 为控制台补齐 Skip Link、文案字典和离线可用的图标/字体策略。
- 让首屏主路径不依赖外部字体或图标 CDN，为国际化和可访问性打底。

### Scope

- `src/main/resources/static/index.html`
- `src/main/resources/static/styles.css`
- `src/main/resources/static/app.js`
- `src/main/resources/static/icons.svg`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `StaticConsoleUiTest.indexHtmlExposesBusinessFriendlyContextAndDetailShells()` 中加入 `href="#mainContent"`、`id="skipToMain"`、`id="mainContent"` 的断言，并对外部 `fonts.googleapis.com`、`cdnjs.cloudflare.com` 链接加入 `doesNotContain(...)` 断言。
- 再在 `StaticConsoleUiTest.appScriptWiresRuntimeSummaryAndMobileDetailInteractions()` 中加入 `const messages = { zhCN:`、`getMessage(`、`renderIconSprite` 的断言。
- 运行 `.\\mvnw.cmd -Dtest=StaticConsoleUiTest test`，确认测试先失败；实现后通过键盘 `Tab` 验证首个可见焦点可跳至主内容，并在断网状态下检查图标和基础文案仍可用。

### Done When

- 首屏主路径不依赖外部字体或图标 CDN。
- 主要文案集中到字典对象。
- 键盘用户可绕过顶部区域直达问答主内容。

## CARD A-05: Merge evidence and trace into a single validation workbench

### Type
code

### Goal

- 把右侧证据面板和审计轨迹合并为统一的验证工作台。
- 交付验证摘要、证据定位抽屉和答案引用联动，缩短验证路径。

### Scope

- `src/main/resources/static/index.html`
- `src/main/resources/static/styles.css`
- `src/main/resources/static/app.js`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `StaticConsoleUiTest.indexHtmlExposesBusinessFriendlyContextAndDetailShells()` 中加入 `id="validationWorkbench"`、`id="validationSummary"`、`id="citationDrawer"`、`id="validationTimeline"` 的断言。
- 再在 `StaticConsoleUiTest.appScriptWiresRuntimeSummaryAndMobileDetailInteractions()` 中加入 `renderValidationWorkbench`、`openCitationDrawer`、`syncValidationState`、`renderValidationSummary` 的断言。
- 再在 `StaticConsoleUiTest.stylesDefineResponsiveTabsCompactStagesAndStateNotes()` 中加入 `.validation-workbench {`、`.citation-drawer {`、`.validation-summary {` 的断言后运行 `.\\mvnw.cmd -Dtest=StaticConsoleUiTest test`；实现后手动验证点击回答引用可在同一区域看到证据与轨迹。

### Done When

- 从回答点击引用到看到对应证据不超过一次额外切换。
- 右栏默认显示验证摘要。
- 重复空状态卡片被移除。

## CARD A-06: Expose transparency fields and low-confidence recovery actions

### Type
code

### Goal

- 扩展响应契约，返回扫描文档数、命中文档数、降级原因、置信度原因和建议动作。
- 把这些字段渲染到验证工作台与低置信度提示中，同时保留 fallback 可用性。

### Scope

- `src/main/java/com/example/springaidemo/domain/tool/Citation.java`
- `src/main/java/com/example/springaidemo/domain/tool/KnowledgeSearchResult.java`
- `src/main/java/com/example/springaidemo/domain/tool/ToolResult.java`
- `src/main/java/com/example/springaidemo/domain/agent/AnswerDraft.java`
- `src/main/java/com/example/springaidemo/domain/agent/AgentResponse.java`
- `src/main/java/com/example/springaidemo/domain/agent/AuditLog.java`
- `src/main/java/com/example/springaidemo/application/orchestrator/MultiAgentQaOrchestrator.java`
- `src/main/java/com/example/springaidemo/controller/AssistantController.java`
- `src/main/resources/static/app.js`
- `src/test/java/com/example/springaidemo/application/orchestrator/MultiAgentQaOrchestratorTest.java`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `MultiAgentQaOrchestratorTest.answerBuildsAuditTrailAndStoresConversation()` 中新增对 `documentsScanned`、`matchedDocuments`、`degradedReason`、`confidenceReason`、`selectedStrategy` 的断言。
- 再在 `MultiAgentQaOrchestratorTest.answerUsesFriendlyFallbackReasonWhenModelIsOverloaded()` 中新增断言，验证降级原因进入响应字段且仍保留本地 fallback 回答。
- 再在 `StaticConsoleUiTest.appScriptWiresRuntimeSummaryAndMobileDetailInteractions()` 中加入 `renderRecoveryActions`、`renderConfidenceReason`、`documentsScanned`、`matchedDocuments` 的断言后运行 `.\\mvnw.cmd test`，确认测试先失败再实现。

### Done When

- 低置信度回答总能展示至少一个可执行下一步动作。
- 降级链路原因对用户可见。
- 无模型配置时仍能完成问答。

## CARD A-07: Save layout presets and restore workspace snapshots

### Type
code

### Goal

- 交付研究员、审核员、支持人员三套布局预设。
- 持久化面板状态、当前 detail view、选中文档和输入草稿，使刷新后可以恢复工作区。

### Scope

- `src/main/resources/static/index.html`
- `src/main/resources/static/styles.css`
- `src/main/resources/static/app.js`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `StaticConsoleUiTest.indexHtmlExposesBusinessFriendlyContextAndDetailShells()` 中加入 `id="layoutPresetMenu"`、`id="saveWorkspaceSnapshot"`、`id="workspaceRestoreNotice"` 的断言。
- 再在 `StaticConsoleUiTest.appScriptWiresRuntimeSummaryAndMobileDetailInteractions()` 中加入 `WORKSPACE_SNAPSHOT_KEY`、`applyLayoutPreset`、`restoreWorkspaceSnapshot`、`persistWorkspaceSnapshot` 的断言。
- 运行 `.\\mvnw.cmd -Dtest=StaticConsoleUiTest test`，确认测试先失败；实现后手动验证切换到“审核员模式”并刷新页面，工作台、选中文档和草稿均能恢复。

### Done When

- 用户可一键切换布局预设。
- 刷新页面后恢复上次工作区。
- 布局切换不会破坏当前对话和证据联动。

## CARD A-08: Reorder the mobile task flow and deepen tablet interactions

### Type
code

### Goal

- 重新定义移动端任务顺序为“状态摘要 -> 输入区 -> 阶段摘要 -> 验证工作台 -> 文档抽屉”。
- 补齐平板横竖屏切换和更大的触控目标，确保移动端先问后查。

### Scope

- `src/main/resources/static/index.html`
- `src/main/resources/static/styles.css`
- `src/main/resources/static/app.js`
- `src/test/java/com/example/springaidemo/staticui/StaticConsoleUiTest.java`

### TDD

- 先在 `StaticConsoleUiTest.stylesDefineResponsiveTabsCompactStagesAndStateNotes()` 中加入 `body[data-viewport-mode="mobile"] .ask-bar {`、`.doc-drawer {`、`.validation-workbench.is-mobile {`、`min-height: 44px;` 的断言。
- 再在 `StaticConsoleUiTest.appScriptWiresRuntimeSummaryAndMobileDetailInteractions()` 中加入 `applyMobileTaskOrder`、`syncTabletLayout`、`setViewportMode('mobile')` 的断言。
- 运行 `.\\mvnw.cmd -Dtest=StaticConsoleUiTest test`，确认测试先失败；实现后在 390px 手机视口和 768px 平板视口分别验证首问入口优先显示、触控目标易点、文档树通过抽屉访问。

### Done When

- 手机端无需先浏览文档树即可直接提问。
- 平板端可稳定切换详情区域。
- 主要点击目标满足最小触控面积。
