# 2026-03-17 tool sensitivity execution governance

## 背景

- `docs/dev/runtime-foundation.md` 的 `P0` 已把下一步收敛到：把高风险 native / compat tool 的 `sensitivity_level -> default execution class` 规则纳入同一条 tool execution contract，而不是继续只依赖作者手工声明 `default_execution_class`。
- 继续复核后发现，当前 `tool default execution` 虽然已经进入 runtime、workflow/workspace starter 保存前校验和 editor preflight，但仍有一个治理缺口：
  - 如果 tool 只在 `SensitiveAccess` 侧被标成 `L2 / L3` 高风险，而 tool contract 本身没有手工声明 `default_execution_class`，作者侧与 runtime 侧都还会把它当作普通轻执行 tool 对待。
  - 这会让“敏感能力治理”和“执行隔离治理”继续分裂成两条事实链，不利于后续把高风险 tool/plugin 收口到统一 sandbox / microvm 主链。

## 目标

1. 把 `local_capability` 敏感资源上的 `sensitivity_level` 显式映射成 tool contract 的派生默认执行级别。
2. 让 plugin registry / workflow library、workflow / workspace starter 保存前校验，以及 runtime `ToolGateway` 都消费同一份派生规则。
3. 保持 `worker-first` 约束：只对高风险 `L2 / L3` tool 自动收口到强隔离默认，不把所有 tool 一刀切重沙箱化。

## 实现

### 1. 新增统一派生 helper

- 新增 `api/app/services/tool_execution_governance.py`：
  - 统一维护 `sensitivity_level -> default execution class` 的最小治理映射。
  - 当前规则为：`L2 -> sandbox`、`L3 -> microvm`；`L0 / L1` 不强推默认强隔离。
  - 当 tool 已显式声明默认执行级别时，helper 会取“显式配置”与“敏感等级推导”中更强的一侧，避免高敏 tool 被较弱默认值静默覆盖。
- 这层 helper 只负责“派生事实”，不引入第二套持久化字段，也不把 sandbox backend / sensitive access 语义混成一个对象模型。

### 2. 把派生结果接回 tool catalog / workflow library

- `api/app/api/routes/plugins.py`
  - `/api/plugins/tools` 现在会把 tool 关联的 `sensitivity_level` 一并返回。
  - 返回给前端和外部调用方的 `default_execution_class` 现在是**治理后生效值**，而不只是数据库里手工配置的原始值。
- `api/app/services/workflow_library.py`
  - workspace 侧 tool library 同步接入相同派生规则。
  - 因此 workflow 保存、workspace starter 保存、editor catalog 与前端 preflight 现在看到的是同一份“高风险 tool 实际默认执行级别”事实。

### 3. 把派生规则接回 runtime 主链

- `api/app/services/tool_gateway.py`
  - 当 tool 没有显式 runtime execution override，且 tool 绑定了高风险 `SensitiveResource(local_capability)` 时，`ToolGateway` 现在会把派生后的默认执行级别写入 runtime `execution` payload。
  - 这意味着 runtime 不再只靠作者手工填 `default_execution_class` 才进入强隔离链；高敏 tool 本身也会沿统一 dispatch / fail-closed 语义执行。
  - 对已有显式 `default_execution_class` 的 tool，如果它弱于敏感等级要求，也会被治理规则提升到更强的有效默认值。

### 4. 前后端提示文案补齐

- `api/app/schemas/plugin.py`、`web/lib/get-plugin-registry.ts`、`web/lib/get-workflow-library.ts`
  - tool item 新增 `sensitivity_level` 字段，前端可直接知道该默认执行级别是否来自高风险治理。
- `web/lib/workflow-tool-execution-validation-helpers.ts`
  - editor preflight 的默认执行级别阻断文案现在会额外提示：当前 tool 是因为 `L2 / L3` 敏感等级而被治理规则收口到 `sandbox / microvm`。

## 影响评估

### 架构链条

- **扩展性增强**：高风险 tool 的默认隔离不再只靠作者逐个手填，后续继续接 `profile / dependency governance` 或更细粒度 `sensitivity -> execution` 策略时，只需沿统一 helper 演进。
- **兼容性增强**：plugin registry、workflow library、editor preflight、workflow 保存、workspace starter 保存和 runtime dispatch 现在共享同一份派生逻辑，减少前后端对“默认执行级别”理解漂移。
- **可靠性 / 稳定性增强**：高风险 tool 的隔离要求更早暴露，避免 workflow author 存下 definition 之后才在真实运行时发现 tool 其实应该走强隔离。
- **安全性增强**：`SensitiveAccess` 不再只负责审批/通知链；它开始对高风险 tool 的执行隔离默认值产生真实治理影响，更符合“敏感资源访问”和“宿主风险隔离”两条治理轴协同而不混线的目标。

### 对产品闭环的帮助

- 这轮属于 **人与 AI 协作层 + AI 治理层** 的直接推进，不是局部重构。
- **人使用**：workflow / starter 作者在 catalog 和保存前就能看到“这个 tool 因为高风险能力而默认需要强隔离”。
- **AI 使用 / 人与 AI 协作**：`llm_agent.allowedToolIds`、tool node binding 和 runtime dispatch 都会继承同一份高风险默认执行级别，减少“作者没意识到风险、AI 运行时才爆炸”的断层。
- **AI 治理**：这一步把 `sensitivity_level` 从审批/通知治理延伸到执行隔离治理，为后续继续做 profile / backend capability / dependency governance 铺平了主链。

## 验证

- 后端定向测试：`api/.venv/Scripts/uv.exe run pytest -q tests/test_plugin_routes.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py tests/test_runtime_sensitive_tool_gateway.py`
  - 结果：`89 passed`
- 后端定向 lint：`api/.venv/Scripts/uv.exe run ruff check app/services/tool_execution_governance.py app/api/routes/plugins.py app/services/workflow_library.py app/services/tool_gateway.py app/schemas/plugin.py tests/test_plugin_routes.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py tests/test_runtime_sensitive_tool_gateway.py`
  - 结果：通过
- 前端类型检查：`web/pnpm exec tsc --noEmit`
  - 结果：通过
- 前端 lint：`web/pnpm lint`
  - 结果：通过（仅有 Next.js 关于 `next lint` 弃用提示）

## 下一步

1. 把高风险 tool 的 `sensitivity_level` 治理解释补到更多 UI：tool catalog card、editor binding summary、publish detail，避免作者只看到默认强隔离结果却不知道原因。
2. 继续推进 native / compat tool 对 `sandbox / microvm` 的**真实隔离兑现**，尤其是 profile / dependency / backend capability 的更细粒度治理，而不是只停留在 dispatch 选择层。
3. 评估是否把同类治理继续扩展到 `sensitivity_level -> execution profile / network policy / filesystem policy`，但前提仍是维持单一 tool execution contract，而不是把敏感访问和执行策略拆成两套分叉模型。
