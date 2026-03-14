# 2026-03-14 Service Module Refactors

## 背景

- 工作区里遗留了一组未提交的服务拆分半成品：
  - `api/app/services/agent_runtime.py` 已开始把 LLM 相关逻辑抽离，但还没有形成完整开发闭环记录。
  - `api/app/services/published_invocations.py` 已新建 `types` / `audit` 文件，但主服务仍未接线，仓库里同时存在新模块和旧大文件。
- 用户长期偏好要求单文件体量可控，并且每轮开发要补齐文档留痕与 Git 提交。

## 目标

1. 把 `AgentRuntime` 的 LLM 逻辑拆分正式落地为可运行结构，而不是停留在未提交中间态。
2. 把 `PublishedInvocationService` 真正切到 `types + audit mixin + 主服务` 的分层结构。
3. 保持发布活动查询、运行时流式和全量后端测试无回归。

## 实现方式

### 1. AgentRuntime 拆分

- 保留 `api/app/services/agent_runtime.py` 作为节点 phase 编排、AI call 记录、工具结果恢复和基础配置辅助的主入口。
- 新增 `api/app/services/agent_runtime_llm_support.py`，承接：
  - LLM 调用封装
  - plan 构建
  - assistant/evidence distill
  - finalize output
  - delta chunking 与文本提取
- `AgentRuntime` 改为继承 `AgentRuntimeLLMSupportMixin`，把主文件从 `1056` 行级别压到 `496` 行，LLM 相关逻辑则集中到 `558` 行的独立 mixin 中。

### 2. PublishedInvocationService 拆分

- 新增 `api/app/services/published_invocation_types.py`，收口：
  - published invocation 相关 type alias
  - dataclass 输出对象
  - request surface / cache status / run status 顺序常量
  - `classify_invocation_reason()`
- 新增 `api/app/services/published_invocation_audit.py`，收口：
  - timeline bucket 构建
  - facet 聚合
  - binding audit 聚合
  - multi-binding summary 聚合
- `api/app/services/published_invocations.py` 现在只保留：
  - payload preview
  - binding 查询语句构建
  - invocation 记录写入
  - list 查询入口
- `PublishedInvocationService` 改为继承 `PublishedInvocationAuditMixin`，主文件从 `1047` 行压到 `287` 行，避免继续把查询、聚合、分类和写入堆在一个 God object 里。

## 影响范围

- `api/app/services/agent_runtime.py`
- `api/app/services/agent_runtime_llm_support.py`
- `api/app/services/published_invocations.py`
- `api/app/services/published_invocation_types.py`
- `api/app/services/published_invocation_audit.py`
- `docs/dev/runtime-foundation.md`

## 验证

- `./api/.venv/Scripts/uv.exe run pytest tests/test_workflow_publish_activity.py -q`：4 passed
- `./api/.venv/Scripts/uv.exe run pytest tests/ -q`：212 passed

## 当前结论

- 这轮是结构治理，不改变 publish audit、rate limit 计数或 AgentRuntime 的既有行为事实。
- `published_invocations.py` 的拆分已经从“未接线草稿”变为真实运行路径。
- 当前后端新的主要结构热点转移为：
  - `api/app/services/published_gateway.py`（约 837 行）
  - `api/app/services/published_invocation_audit.py`（约 663 行）
  - `api/app/services/agent_runtime_llm_support.py`（约 558 行）

## 下一步

1. 优先继续推进 publish governance 的业务闭环：补单次 invocation detail，以及到 `run / callback ticket / cache` 的稳定钻取入口。
2. 在 `LLMProviderService` 补 `stream_options.include_usage`，让流式 finalize 也能记录 token usage。
3. 若 publish gateway 继续增长，优先按 protocol surface / mapper / audit 边界继续拆 `published_gateway.py`，避免热点从一个文件平移到另一个文件。
