# 仓库执行契约

本文件是 `D:\桌面文件\project\springai-demo1` 及其子目录的代理工作合同。仓库内规则优先于通用模板；不要把外部大型 `AGENTS.md`、`OMX` 总章程或不存在的配套文档整段搬进来。

目标很简单：基于仓库真实结构工作，优先保护知识库问答主链路、fallback 行为和知识库目录结构，用小而可验证的改动完成任务。

## 1. 仓库定位与目标

- 这是一个 `Spring Boot + Spring AI + 静态前端` 的知识库问答 demo。
- 用户主链路是：文档浏览 -> 发起提问 -> 规划/检索/研究/生成 -> 查看证据与轨迹。
- 修改时优先保护这些能力：
  - `src/main/resources/static/` 中的聊天、证据联动和响应式布局。
  - `application/orchestrator` 中的多阶段编排。
  - `infra/fallback` 中的本地 fallback 路径。
  - `src/main/resources/knowledge-base/` 的目录层级、标题提取和检索可用性。

## 2. 代码地图

- `src/main/java/com/example/springaidemo/controller`：HTTP 入口，保持薄控制器。
- `src/main/java/com/example/springaidemo/application`：编排、代理接口、工具接口和核心用例。
- `src/main/java/com/example/springaidemo/domain`：不可变记录、值对象、请求/响应契约。
- `src/main/java/com/example/springaidemo/infra`：Spring AI、fallback、memory、retrieval 等适配层。
- `src/main/java/com/example/springaidemo/config`：Spring Bean 与配置装配。
- `src/main/resources/static`：前端页面、样式和交互脚本。
- `src/main/resources/knowledge-base`：Markdown 知识库语料。
- `src/test/java`：与业务包结构对应的测试。

开发、构建和运行统一使用 Maven Wrapper；在当前 Windows 环境下优先使用 `mvnw.cmd`：

- `mvnw.cmd spring-boot:run`
- `mvnw.cmd test`
- `mvnw.cmd -DskipTests package`

## 3. 代理执行原则

- 先探索，再修改；先确认真实代码路径、配置和调用链，不要凭模板猜。
- 保持 diff 小、可审查、可回滚；不要顺手重写无关文件。
- 优先复用现有分层和命名模式，不新增无必要抽象。
- 禁止 destructive git 操作，例如 `git reset --hard`、`git checkout -- <file>`、强制覆盖用户已有改动。
- 涉及 `Spring AI agent`、`tool calling`、`RAG`、`memory`、`advisor`、多代理编排等任务时，优先使用仓库已有 skill：`.codex/skills/spring-ai-agent-dev/SKILL.md`。
- `.omx/` 是运行态目录，不是常规业务实现落点；除非任务明确要求修改代理编排或 OMX 配置，否则不要把改动落到这里。

## 4. 改动边界与产物卫生

- `local.yml` 视为私有配置：默认不修改、不提交；只有用户明确要求处理本地私密配置时才碰。
- `local.yml.example` 只能保留安全占位符，不能写入真实密钥、真实令牌或私有地址。
- 下列路径默认视为运行产物、缓存或调试输出，不要作为实现目标，也不要顺手提交：
  - `target/`
  - `output/`
  - `test-results/`
  - `.omx/`
  - `.m2/`
  - `.codex-*.log`
- `.codex/` 目录下当前存在仓库内 skill；除非任务本身是维护 skill，否则不要把业务实现写进 `.codex/`。
- 修改 `src/main/resources/knowledge-base/**/*.md` 时，必须考虑：
  - 目录层级会影响左侧文档树。
  - `# Heading` 会影响标题提取和来源展示。
  - 语料变更后需要重启应用以重建索引。
- 修改 `src/main/resources/static/` 时，默认关注聊天主链路、证据高亮联动、移动端布局，以及需要截图说明的用户可见变化。
- 修改编排器、检索、模型接入时，必须保护 fallback 路径；不要把默认开发路径变成“必须依赖外部模型或外部向量库才能启动”。

## 5. 验证要求

- 后端 Java 代码改动后，至少运行 `mvnw.cmd test`。
- 配置、启动链路或依赖接入改动后，至少做一次最小可用性验证；推荐 `mvnw.cmd spring-boot:run`。如果因外部依赖不可达无法完整验证，必须在结果中明确说明阻塞点。
- 前端改动后，至少检查页面是否能加载、主交互是否可走通；涉及明显 UI 变化时，准备截图或行为说明。
- 修改 `Spring AI / retrieval / fallback` 相关代码时，验证重点不是“模型路径工作了”，而是“失败或缺配置时是否仍能给出合理降级行为”。
- 文档类改动也要做静态核对：确认命令、路径、目录和流程都与当前仓库事实一致。

## 6. Git 与提交规范

- 当前仓库已经包含 `.git` 元数据；执行 Git 命令前先确认工作区状态，不要假设这是脱离版本控制的副本。
- 提交应保持小而可回滚；如果工作区已有无关改动，避免覆盖或回退它们。
- 提交信息遵循 Lore 风格：首行写“为什么改”，正文补约束与取舍，常用 trailers 包括：
  - `Constraint:`
  - `Rejected:`
  - `Confidence:`
  - `Scope-risk:`
  - `Directive:`
  - `Tested:`
  - `Not-tested:`
- 涉及 `src/main/resources/static/` 的改动，在提交说明或 PR 说明里补充用户可见影响与验证方式；必要时附截图。
- 如果任务只要求修改文档或规则，不要顺手整理 `.gitignore`、README 或其他文件，除非用户明确要求。
