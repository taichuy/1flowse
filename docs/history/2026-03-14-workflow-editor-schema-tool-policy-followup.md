# 2026-03-14 Workflow Editor Schema / Tool Policy Follow-up

## 背景

- 本轮开始前，最近一次提交 `6e19492 feat: add workflow editor runtime policy form` 已把节点 `runtimePolicy.retry / join` 从纯 JSON 文本推进成结构化 section。
- 结合 `docs/dev/runtime-foundation.md` 的现状判断，workflow editor 的下一优先级不是重做画布骨架，而是继续把节点契约与权限相关配置从“混在高级 JSON 里”推进到独立 section。
- 这也直接对应本轮项目复核中的几个问题：基础框架是否可继续推进、是否存在需要衔接的上一轮工作、哪些文件和职责还需要进一步解耦。

## 目标

1. 延续上一轮 workflow editor 方向，补齐节点 `inputSchema / outputSchema` 的专属编辑入口。
2. 把 `llm_agent.config.toolPolicy` 从隐含字段显式化，避免工具权限继续埋在 JSON 里。
3. 顺手把相关前端职责拆开，避免单个配置文件继续增长。
4. 更新当前事实索引，明确“项目已具备持续功能开发条件，但还未进入只剩人工界面验收阶段”。

## 实现

### 1. 节点契约独立 section

- 新增 `web/components/workflow-node-config-form/node-io-schema-form.tsx`。
- inspector 现在会为所选节点单独展示 `input schema` / `output schema` 区块，不再要求继续混在 `Advanced config JSON` 里编辑。
- 该区块当前仍保留 JSON 入口，但已经具备：
  - 单独的输入/输出 schema 文本区
  - `object` 模板快捷入口
  - 单独应用 / 清空动作
  - 基本 JSON 对象校验与错误提示
- 这样做的目的不是一次性造完整 schema builder，而是先把“节点契约”从通用 config 中剥离，形成稳定演进位置。

### 2. LLM Agent tool policy 显式化

- 新增 `web/components/workflow-node-config-form/llm-agent-tool-policy-form.tsx`。
- `llm_agent` 配置表单现在可直接编辑：
  - `toolPolicy.timeoutMs`
  - `toolPolicy.allowedToolIds`
- 工具白名单直接消费持久化 tool catalog；空白名单语义保持为“不额外限制”。
- 这与后端 `WorkflowNodeToolPolicy` / `AgentRuntime._allowed_tool_ids()` 的当前语义保持一致，没有引入第二套前端专用模型。

### 3. 编辑器联动与职责边界

- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts` 新增节点 `inputSchema / outputSchema` 更新入口。
- `web/components/workflow-editor-inspector.tsx` 改为聚合：
  - 节点基础配置表单
  - 节点契约 section
  - 高级 config JSON
  - runtimePolicy section
- `web/components/workflow-node-config-form/llm-agent-node-config-form.tsx` 把 tool policy UI 拆出后，职责比此前更清晰。

## 对项目现状的判断

### 1. 是否需要衔接上一轮提交

- 需要，而且本轮已直接衔接。
- 上一轮提交解决的是 `runtimePolicy`；本轮继续解决的是同一条优先级链上的 `input/output schema` 与 `toolPolicy`。
- 因此当前 workflow editor 的开发方向是连续的，不存在需要回退或改线的迹象。

### 2. 基础框架是否已经足够支撑后续功能开发

- 结论：**足够支撑持续功能开发，但还没进入“只剩 UI 打磨”阶段。**
- 后端方面，runtime / published gateway / run tracing / credential / tool catalog 已提供稳定事实层。
- 前端方面，workbench、run diagnostics、publish governance、node config forms 已形成可继续补齐的骨架。
- 当前更像“骨架已成、关键业务能力持续补齐”的阶段，而不是“架构未稳不宜开发”。

### 3. 扩展性、兼容性、可靠性与安全性判断

- **扩展性**：整体方向成立，尤其是 `7Flows IR`、published surfaces、tool catalog、credential store 的分层已经为兼容 Dify 插件和后续发布扩展留出边界。
- **兼容性**：当前兼容边界仍基本符合文档约束，没有让 OpenAI / Anthropic surface 反向主导内部模型。
- **可靠性 / 稳定性**：run / node_run / run_events 已是稳定事实源，但 `WAITING_CALLBACK` 的后台唤醒闭环仍是下一阶段关键缺口。
- **安全性**：显式上下文授权、credential store、tool policy 白名单方向正确，但真正的高风险点仍在 sandbox、危险工具与 callback durable execution 的后续补强。

### 4. 代码解耦判断

- 当前最值得继续拆的热点仍然存在，但整体已从“明显失控”回到“可治理”区间。
- 本轮优先顺手收缩了 `llm-agent-node-config-form.tsx` 的职责；更大的热点依旧包括：
  - `web/components/run-diagnostics-execution-sections.tsx`
  - `api/app/services/published_protocol_streaming.py`
  - `api/app/services/published_gateway.py`
  - `api/app/services/workflow_library.py`
- 这些文件尚未突破用户要求的体量上限，但都已经是后续继续拆层的高价值目标。

## 影响范围

- `web/components/workflow-editor-inspector.tsx`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
- `web/components/workflow-node-config-form.tsx`
- `web/components/workflow-node-config-form/llm-agent-node-config-form.tsx`
- `web/components/workflow-node-config-form/llm-agent-tool-policy-form.tsx`
- `web/components/workflow-node-config-form/node-io-schema-form.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

- 计划使用 `pnpm lint` 验证前端类型与 lint 基本通过。

## 下一步

1. P0：继续把 workflow `publish` 配置从 definition JSON 中拆出独立 section，打通 editor 与 publish governance 的前后衔接。
2. P1：推进 `WAITING_CALLBACK` 的后台唤醒闭环，补 durable execution 的调度链路。
3. P1：继续拆 `run-diagnostics-execution-sections.tsx`，保持摘要优先、详情可钻取。
4. P1：继续治理 `published_protocol_streaming.py` 与 `published_gateway.py` 的 surface orchestration 热点。
