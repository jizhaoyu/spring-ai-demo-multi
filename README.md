# Spring AI 多代理知识库问答 Demo

一个基于 Spring Boot 3 + Spring AI 1.0 的本地知识库问答示例。

它把 Markdown 知识库、四阶段多代理编排、SSE 流式回传和静态前端控制台串成一条完整链路：你可以浏览文档树、向知识库提问、查看检索证据，并观察规划/检索/研究/生成各阶段的执行状态。

当前控制台界面已经升级为更偏“验证工作台”的交互形态：首屏优先提问，回答区、证据区和执行轨迹会联动更新，适合在业务问答、知识核验和降级链路观察之间快速切换。

这个仓库有两个很重要的运行特性：

- 默认可直接启动，不依赖外部向量库。
- 即使没有配置模型，也会进入本地 fallback 降级链路，知识库浏览和证据检索仍然可用。

## 项目亮点

- 四阶段问答编排：`planner -> retrieval -> research -> response`
- 前端实时展示阶段进度、运行模式、证据卡片、验证摘要和审计轨迹
- 本地 Markdown 索引与分块检索，不依赖 embedding 接口或外部向量数据库
- 支持目录树浏览、文档筛选、指定文档上下文提问
- 支持最近使用、固定文档和推荐文档工作集
- 当模型不可用时，自动切换到本地规划/研究/回答 fallback 代理
- 返回回答时附带证据来源、置信度、追问建议和执行线索

## 技术栈

- Java 21
- Spring Boot 3.5.3
- Spring AI 1.0.0
- Maven Wrapper
- 原生静态前端：`HTML + CSS + Vanilla JS`

## 运行模式

应用启动后会根据模型配置和知识库状态自动展示当前模式：

| 模式 | 触发条件 | 表现 |
| --- | --- | --- |
| 正常模式 | `spring.ai.model.chat=openai` 且知识库可用 | 使用 Spring AI 模型链路回答问题 |
| 降级模式 | 未配置模型或模型链路失败，但知识库可用 | 使用本地 fallback 代理回答，仍能检索并展示证据 |
| 知识库离线 | 未加载到知识库文档或索引初始化失败 | 无法提供可靠证据，前端会提示知识库不可用 |

默认 `src/main/resources/application.yml` 中将 `spring.ai.model.chat` 设为 `none`，因此开箱即用时通常会进入“降级模式”。

## 仓库结构

| 路径 | 说明 |
| --- | --- |
| `src/main/java/com/example/springaidemo/controller` | HTTP 入口，暴露问答与知识库目录接口 |
| `src/main/java/com/example/springaidemo/application/orchestrator` | 多阶段问答编排与流式事件分发 |
| `src/main/java/com/example/springaidemo/application/agent` | 规划、研究、回答代理接口 |
| `src/main/java/com/example/springaidemo/infra/springai` | 基于 Spring AI 的模型代理实现 |
| `src/main/java/com/example/springaidemo/infra/fallback` | 本地 fallback 规划/研究/回答实现 |
| `src/main/java/com/example/springaidemo/infra/retrieval` | Markdown 索引、目录树构建与本地检索 |
| `src/main/resources/static` | 前端页面、样式和交互逻辑 |
| `src/main/resources/knowledge-base` | 示例知识库语料 |
| `src/test/java` | 编排、检索和静态页面相关测试 |

## 问答链路

```text
浏览器页面
  -> AssistantController
  -> MultiAgentQaOrchestrator
  -> Planner
  -> LocalKnowledgeSearchTool
  -> Research
  -> Response
  -> AgentResponse + AuditLog + Citations
```

其中：

- `planner` 负责分析问题并生成检索策略。
- `retrieval` 负责从本地 Markdown 分块中找证据。
- `research` 负责基于证据形成研究摘要与回答思路。
- `response` 负责生成最终答案、置信度和追问建议。

如果 Spring AI 模型调用失败，编排器会在对应阶段自动退回到本地 fallback 实现，而不是直接让请求整体失败。

## 快速开始

### 1. 环境要求

- JDK 21
- 能执行 Maven Wrapper
- 可选：一个兼容 OpenAI 风格接口的聊天模型服务

当前仓库在 Windows 环境下优先使用 `mvnw.cmd`；如果你在 macOS / Linux 上运行，可将下面命令替换为 `./mvnw`。

### 2. 直接启动（无需模型配置）

```powershell
.\mvnw.cmd spring-boot:run
```

启动后访问：

- `http://localhost:8080/`

这时应用通常会以“降级模式”运行，但知识库浏览、证据检索、SSE 阶段流和本地回答链路都可以正常体验。

### 3. 配置模型增强模式（可选）

如果你想启用 Spring AI 模型链路，在项目根目录创建或修改 `local.yml`。

可直接参考：

- `local.yml.example`

示例配置：

```yaml
spring:
  ai:
    model:
      chat: openai
    openai:
      api-key: REPLACE_WITH_YOUR_API_KEY
      base-url: https://api.moonshot.cn
      chat:
        options:
          model: kimi-k2.5
          temperature: 0.2
```

说明：

- `local.yml` 通过 `spring.config.import=optional:file:./local.yml` 自动加载。
- `local.yml` 是本地私有配置，不应提交真实密钥。
- 只要把 `spring.ai.model.chat` 切到 `openai`，应用就会尝试进入“正常模式”。

### 4. 打包运行

```powershell
.\mvnw.cmd -DskipTests package
java -jar target/springai-demo1-0.0.1-SNAPSHOT.jar
```

## 前端体验

首页控制台默认包含这些能力：

- 左侧知识库目录树与关键词筛选
- 左侧工作集导航：最近使用、已固定文档、推荐文档
- 指定某篇文档作为上下文后再提问
- 中间聊天主区实时展示问答内容
- 输入区首屏优先展示，并支持草稿自动暂存
- 阶段条实时显示 `规划 / 检索 / 研究 / 生成`
- 验证工作台统一展示证据概览、证据列表和执行轨迹
- 回答卡片支持复制答案、查看执行轨迹和一键追问
- 证据卡片支持高亮、复制证据和来源联动
- 快捷键帮助面板与高频键盘操作
- 深色模式、专注模式、移动端抽屉式文档面板与响应式布局

## 交互补充

新版控制台围绕“先提问，再验证”设计，默认交互节奏如下：

1. 在主输入区直接提问，必要时先从左侧工作集或文档树限定上下文。
2. 系统通过 SSE 回传阶段状态，并在聊天区持续更新回答。
3. 右侧验证工作台同步展示证据概览、证据列表与执行轨迹。
4. 如果回答可信度偏低、命中证据较少或进入 fallback，界面会在摘要和轨迹中给出更明显提示。

常用快捷操作包括：

- `Ctrl / Cmd + Enter`：发送问题
- `/`：聚焦文档搜索
- `Ctrl / Cmd + K`：聚焦提问输入框
- `Alt + 1`：切换到证据面板
- `Alt + 2`：切换到轨迹面板
- `?`：打开快捷键帮助面板

## API 概览

### `POST /api/assistant/ask`

同步问答接口。

请求体：

```json
{
  "question": "标准支持的响应时间是多久？",
  "conversationId": "conv-001"
}
```

说明：

- `question` 必填
- `conversationId` 选填；不传时服务端会自动生成

响应体核心字段：

```json
{
  "conversationId": "conv-001",
  "traceId": "trace-id",
  "answer": "回答内容",
  "confidence": "HIGH",
  "followUpQuestions": [
    "是否还需要查看优先支持的响应时限？"
  ],
  "sources": [
    {
      "sourceId": "support/policies.md",
      "title": "支持策略",
      "excerpt": "..."
    }
  ],
  "auditLog": {
    "...": "..."
  }
}
```

### `POST /api/assistant/ask/stream`

SSE 流式问答接口，前端主链路默认使用它。

事件类型包括：

- `session`：创建执行会话
- `stage`：阶段开始或完成
- `done`：返回最终回答
- `error`：链路执行失败

前端会基于这些事件更新：

- 顶部运行状态与阶段条
- 回答草稿和最终回答卡片
- 证据概览与证据列表
- 审计轨迹与验证摘要

### `GET /api/assistant/catalog`

返回知识库目录树、文档数量和当前运行状态。

### `GET /actuator/health`

基础健康检查接口。

## 知识库维护方式

知识库默认从下面的路径加载：

- `src/main/resources/knowledge-base/**/*.md`

维护知识库时请注意：

1. 目录层级会直接影响左侧文档树结构。
2. 文档首个 `# Heading` 会作为展示标题。
3. 文档首个非空段落会作为摘要。
4. 文本会按段落切分并按 `chunk-size` 聚合后参与检索。
5. 修改知识库语料后需要重启应用，重新构建本地索引。

当前示例知识库包含：

- `platform/overview.md`
- `operations/runbook.md`
- `support/policies.md`

## 关键配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `spring.ai.model.chat` | `none` | 是否启用模型增强链路 |
| `assistant.knowledge-base.resource-pattern` | `classpath*:knowledge-base/**/*.md` | 知识库扫描路径 |
| `assistant.knowledge-base.top-k` | `4` | 最多返回的证据条数 |
| `assistant.knowledge-base.min-score` | `0.55` | 检索阈值配置入口 |
| `assistant.knowledge-base.chunk-size` | `700` | 本地分块长度 |

## 常用命令

```powershell
.\mvnw.cmd test
.\mvnw.cmd -DskipTests package
.\mvnw.cmd spring-boot:run
```

## 验证建议

修改代码或知识库后，至少做以下检查：

1. 执行 `.\mvnw.cmd test`
2. 启动应用并访问 `http://localhost:8080/`
3. 发起一次提问，确认阶段流、回答区、验证工作台和回答联动正常
4. 切换证据/轨迹面板，确认复制、追问、聚焦和移动端抽屉交互可用
5. 如修改了知识库，确认目录树、工作集、标题和摘要展示符合预期

## 故障排查

### 1. 启动后显示“降级模式”

这是预期行为之一，通常说明：

- 没有配置 `local.yml`
- `spring.ai.model.chat` 仍为 `none`
- 模型服务暂时不可用，系统已自动退回本地 fallback

### 2. 页面能打开，但知识库目录为空

优先检查：

- `src/main/resources/knowledge-base` 下是否存在 `.md` 文件
- Markdown 文件是否被打进了运行时 classpath
- 修改文档后是否已经重启应用

### 3. 有回答但没有证据

可能原因：

- 当前问题没有匹配到足够相关的 Markdown 片段
- 该次请求走了跳过检索或无证据 fallback 路径
- 问题过于宽泛，建议缩小范围或指定某篇文档后再提问

## 适合继续扩展的方向

- 接入真实 embedding 与向量库
- 增加更细粒度的代理工具调用
- 把对话记忆从内存实现替换为持久化存储
- 增强 audit log 与可观测性面板
- 为不同知识库目录增加租户或权限隔离
