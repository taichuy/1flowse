# 2026-03-13 项目现状复核与优先级衔接

## 背景

本轮工作先按仓库级约定复核了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/technical-design-supplement.md`
- `docs/dev/runtime-foundation.md`
- 最近一组 Git 提交与当前源码目录结构

目标不是重新写一版设计，而是回答当前项目是否已经具备“继续稳定推进”的基础，并把下一步真正该做的事按优先级收口。

## 当前结论

### 1. 上一次 Git 提交做了什么，是否需要衔接

当前 `HEAD` 为 `a0dc29c feat: add publish run status governance`。

这次提交主要做了三类承接：

1. 后端为 published endpoint invocation 增加 `run_status` 维度：
   - 查询参数支持按 `run_status` 过滤
   - summary / facets / timeline 增加 `run_status` 聚合
   - 让 publish governance 可以区分“请求已受理”与“workflow 仍处于 waiting / running / succeeded / failed”的状态
2. 前端 workflow 页面把 `run_status` 接到 binding 级治理面板：
   - 服务端过滤
   - active chips
   - traffic mix
   - timeline 展示
3. 文档与测试同步补齐：
   - 新增发布治理开发记录
   - 更新 `runtime-foundation`
   - 增补相关路由与治理测试

结论：**需要继续衔接**。

原因不是“上一轮没做完”，而是这条线已经连续 5 次提交都围绕 published endpoint governance 与 async bridge 扩展：

- `65bf4e0 feat: add publish api key governance signals`
- `a16f9d3 feat: add publish cache status governance`
- `aea4db5 feat: harden published native async governance`
- `2f03bed feat: add published protocol async bridge`
- `a0dc29c feat: add publish run status governance`

这说明当前真正稳定推进中的主线是 `API 调用开放 / 发布治理`，应继续往下承接到：

1. `streaming / SSE` 发布链路
2. waiting / async lifecycle drilldown
3. 发布态与统一事件流 / run diagnostics 的事实对齐

不建议此时突然切回无关子线，否则会把刚建立起来的发布治理连续性打断。

### 2. 基础框架是否已经设计并写好

结论：**基础框架已经写到“可持续推进”的程度，但还没有达到“核心业务已完整闭环”的程度。**

目前已具备的基础包括：

- 后端基础：
  - FastAPI + Alembic + Celery 基础设施已经落地
  - `runs / node_runs / run_events / run_artifacts / tool_call_records / ai_call_records` 已成型
  - Durable Agent Runtime Phase 1 已存在最小闭环
- 运行时分层：
  - `flow_compiler`
  - `runtime`
  - `agent_runtime`
  - `tool_gateway`
  - `context_service`
  - `artifact_store`
  - `published_gateway`
- 前端骨架：
  - workflow editor workbench 已存在骨架
  - run diagnostics 已能消费 execution / evidence 聚合视图
  - publish governance 已具备 lifecycle、API key、cache、run status 等治理面板
- 工程化基础：
  - Docker 中间件 / 全栈模式
  - `uv` 后端环境
  - `pnpm` 前端环境
  - 开发记录与用户偏好留痕机制

但离产品设计要求仍有明显缺口：

- 独立 queue / scheduler / callback event bus 还未完整收口
- `WAITING_CALLBACK` 的后台自动唤醒仍不是完整事件驱动闭环
- Loop / Subflow 运行时边界尚未正式落地
- Dify 插件兼容层、插件 UI 协议、沙盒策略仍主要停留在设计与局部基础设施阶段
- 发布层到 OpenAI / Anthropic 风格接口的完整 workflow-backed provider 仍未完成
- editor 与 runtime 的 phase / evidence / artifact 对齐仍只完成一部分

因此判断是：**框架不是空的，已经可以承载继续开发；但当前更像“骨架 + 主干能力 + 一条正在成型的发布治理主线”，还不是产品完成态。**

### 3. 架构之间是否已基本解耦分离

结论：**目录和职责分层基本对，但部分实现仍有明显集中化热点，需要继续拆。**

当前做得比较对的部分：

- `api/app/api/routes` 与 `api/app/services` 已按路由层 / 业务层拆开
- 运行时侧已明确拆成 compiler、runtime、agent runtime、tool gateway、context、artifact、publish gateway 等模块
- 前端已开始把复杂页面按工作台、治理面板、筛选表单、细分 section 拆开
- `workflow-publish-activity-panel` 与 `workspace-starter-library` 已出现“先拆稳定职责，再继续扩展”的正确方向

当前仍然偏重或耦合偏高的点：

- `api/app/services/runtime.py`
  - 仍然同时承担流程推进、状态写入、恢复调度、工具 / agent 执行编排等多重职责
- `api/app/services/published_invocations.py`
  - 同时承担聚合、时间桶构建、facet 汇总、审计明细拼装等职责，已经接近一个治理域的“全能文件”
- `api/tests/test_runtime_service.py`
  - 体量已超过用户偏好阈值，后续理解与补测成本会继续上升
- `web/components/run-diagnostics-panel.tsx`
  - 聚合视图方向是对的，但仍然承担较多 UI 装配职责，后续容易继续膨胀
- `web/components/workflow-editor-workbench.tsx`
  - 虽然已拆出子目录，但主 workbench 仍是 editor 状态汇聚点，继续扩展前要谨慎控制输入来源与副作用

总体判断：**架构方向是解耦的，实现层面还需要继续“沿着现有边界往下切”，而不是推倒重来。**

### 4. 哪些代码文件已经明显过长，应该优先拆

按当前 tracked source 粗看，最需要关注的热点如下：

- 后端：
  - `api/tests/test_runtime_service.py`：1595 行
  - `api/app/services/runtime.py`：1502 行
  - `api/tests/test_run_routes.py`：1189 行
  - `api/tests/test_workflow_publish_routes.py`：1170 行
  - `api/app/services/published_invocations.py`：1047 行
  - `api/app/services/published_gateway.py`：799 行
  - `api/app/services/runtime_graph_support.py`：713 行
- 前端：
  - `web/components/workspace-starter-library.tsx`：788 行
  - `web/components/run-diagnostics-panel.tsx`：636 行
  - `web/components/workflow-editor-workbench.tsx`：580 行

补充判断：当前工作区里已经开始沿着“先拆热点文件、再补业务闭环”的方向收口，
其中 `web/components/workflow-publish-activity-panel.tsx` 已降到 51 行，
`web/components/workspace-starter-library.tsx` 也已回落到 788 行，说明“沿现有边界继续拆”是有效路径；
因此下一个最该优先切的热点仍然是 `api/app/services/runtime.py` 与 `api/tests/test_runtime_service.py`，而不是重新设计第二套运行时骨架。

结合当前主线与风险，优先拆分顺序建议是：

1. `api/app/services/runtime.py`
2. `api/tests/test_runtime_service.py`
3. `api/app/services/published_invocations.py`
4. `web/components/run-diagnostics-panel.tsx`
5. `web/components/workspace-starter-library.tsx`

其中前两项优先级最高，因为它们直接卡在 Durable Runtime 主链路上；如果继续堆功能，会同时拖慢运行时演进与测试可信度。

### 5. 主要功能业务是否还能持续推进到产品目标

结论：**可以继续推进，而且当前最重要的是“沿主线补完整度”，不是再做新的大方向分叉。**

原因：

- 产品设计要求的核心不是“一次性把所有能力做完”，而是围绕 `7Flows IR` 建成“可编排、可调试、可发布、可兼容、可追溯”的平台。
- 当前仓库已经具备：
  - 编排基础：workflow / version / blueprint / editor skeleton
  - 调试基础：run detail / trace / execution / evidence 视图
  - 发布基础：published endpoint / api key / cache / protocol surface / invocation governance
  - 可追溯基础：runs / node_runs / run_events / artifacts
- 真正的缺口主要集中在：
  - runtime 恢复与事件驱动完整度
  - 发布层 streaming 与 waiting 生命周期
  - editor 与 runtime phase/evidence/artifact 的回接
  - Dify 插件兼容与沙盒真正落地

也就是说，项目现在不是“基础框架没写好导致无法推进”，而是“主干已经有了，接下来要按优先级补关键闭环”。

## 优先级建议

### P0：继续承接 published endpoint governance 主线

1. 把 `streaming / SSE` 接入 publish layer，并映射到统一事件流
2. 把 waiting / async lifecycle drilldown 接到治理面板与 run diagnostics 跳转
3. 明确 published invocation 与 run / callback ticket / cache 命中之间的可追踪链路

为什么是 P0：

- 这是最近连续多次提交的主线
- 它直接服务“API 调用开放”这条产品主业务线
- 继续做下去能最快形成“可发布、可治理、可追溯”的阶段性成果

### P1：收口 Durable Runtime 的高风险集中点

1. 拆 `api/app/services/runtime.py`
   - phase 执行推进
   - waiting / resume 协调
   - 事件写入与状态迁移
   - agent/tool 适配调用
2. 拆 `api/tests/test_runtime_service.py`
   - 按 phase / waiting / callback / artifact / join 等场景分组
3. 继续增强 `Tool Gateway`
   - schema 校验
   - 权限边界
   - timeout / retry / fallback
4. 继续增强 `llm_agent` 结构化配置
   - 输出契约
   - assistant trigger 阈值
   - tool policy

为什么是 P1：

- 这是 Durable Runtime 从“能跑”进入“能稳定扩展”的前提
- 如果不先拆集中点，后续 Loop / Scheduler / 插件兼容都会继续叠加到超长文件上

### P2：把 editor / diagnostics / runtime 事实进一步统一

1. 把 phase timeline / tool summary / evidence / artifact 引用从 diagnostics 回接 editor overlay
2. 让节点配置与运行态模型显式表达 phase、artifact、tool 权限、evidence 关系
3. 继续把 starter governance 与 editor 创建流对齐

为什么是 P2：

- 产品设计强调“可编排 + 可调试 + 可追溯”一体化
- 当前 diagnostics 已经先走了一步，下一步应回接编辑器，而不是再做第二套运行态表达

### P3：进入兼容层与更完整的发布映射

1. 推进 Dify 插件兼容代理的最小可用链路
2. 推进 Plugin UI 协议和节点内嵌配置面板最小闭环
3. 推进 workflow-backed provider 到 OpenAI / Anthropic 风格接口的完整映射
4. 在主要闭环稳定后安排一次人工全链路完整测试

为什么是 P3：

- 这些能力决定产品是否达到“可兼容”的目标
- 但它们应建立在 runtime、diagnostics 和 publish governance 主干更稳定之后

## 建议的下一轮开发入口

如果下一轮直接开始写代码，建议优先从下面二选一进入：

1. **发布主线入口**：`streaming / SSE + waiting lifecycle drilldown`
   - 与最近提交连续性最好
   - 最快增强发布治理闭环
2. **运行时治理入口**：拆 `api/app/services/runtime.py`
   - 最能降低后续继续开发的结构风险
   - 会直接改善 Durable Runtime 的可维护性

如果只能选一个，当前更建议先做 **发布主线入口**，然后立刻回到 runtime 拆分。

## 验证说明

本轮先完成现状复核与优先级收口；在做发布治理定向回归时，又继续承接了一次真实修复。

- 定向验证发现：当前未提交的 publish governance 衔接里，`published_endpoint_activity` 试图从 `Run` 直接读取 `waiting_reason`，但该事实真实落在 `NodeRun`，导致发布调用审计列表在 waiting run 场景下报错。
- 已修复：`api/app/api/routes/published_endpoint_activity.py` 改为同时查询 `Run + NodeRun`，优先用当前 `run.current_node_id` 对应的 node run 回填 `run_waiting_reason`，并在缺少 current node 命中时退回 waiting node run。
- 回归结果：在 `api/` 下执行 `python -m pytest tests/test_published_native_async_routes.py tests/test_workflow_publish_activity.py -q`，`5 passed`。

验证依据包括：

- 核心设计文档与开发记录
- 最近 5 次 Git 提交主线
- `api/` / `web/` 当前目录与模块拆分情况
- tracked source 的大文件体量扫描
