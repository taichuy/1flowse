---
memory_type: project
topic: CI 与 coverage 第三阶段设计已确认
summary: 用户在 `2026-04-19 20` 确认第三阶段采用“仓库内 coverage 脚本 + GitHub Actions 调用仓库脚本”的方案。coverage 不并入 `verify-repo`，而是新增 `verify-coverage` 与 `verify-ci` 两个入口；前端 coverage 首批只评估 `agent-flow` 与 `settings`，后端只评估 `control-plane`、`storage-pg`、`api-server`，并按模块或 crate 设置阈值。GitHub Actions 首版仅负责安装依赖、安装 `cargo-llvm-cov`、执行 `node scripts/node/verify-ci.js` 并上传 `tmp/test-governance/` 产物，不在 workflow 内重复定义平行命令逻辑。
keywords:
  - ci
  - coverage
  - github-actions
  - verify-coverage
  - verify-ci
  - agent-flow
  - settings
  - control-plane
  - storage-pg
  - api-server
match_when:
  - 需要继续实现 coverage gate
  - 需要编写 CI workflow
  - 需要确认 coverage 阈值范围
  - 需要决定 coverage 是否并入 verify-repo
created_at: 2026-04-19 20
updated_at: 2026-04-19 20
last_verified_at: 2026-04-19 20
decision_policy: verify_before_decision
scope:
  - scripts/node
  - web
  - api
  - .github/workflows
  - README.md
---

# CI 与 coverage 第三阶段设计已确认

## 时间

`2026-04-19 20`

## 谁在做什么

- 用户要求在已完成测试分层和状态机治理前两阶段后，继续推进 coverage 与 CI 的第三阶段。
- AI 基于当前仓库入口、前端 Vite/Vitest 配置、后端 Rust workspace 结构和现有 warning 策略，给出第三阶段设计。
- 用户确认采用“仓库脚本收口 + GitHub Actions 调仓库脚本”的实现路线。

## 为什么这样做

- 当前仓库已经有本地 `fast/full/runtime-gate` 和 repo full gate 入口，但 coverage 与 CI 仍未收口进仓库。
- 如果直接把 coverage 塞进 `verify-repo`，会让本地常用 full gate 过重，也会模糊“全量验证”和“覆盖率评估”的边界。
- 如果只写 workflow 不写仓库脚本，本地与 CI 很容易漂移成两套命令语义。

## 为什么要做

- 让 coverage 成为正式的质量治理能力，而不是临时脚本或外部系统中的隐性逻辑。
- 让 CI 明确复用仓库脚本，减少维护成本和行为分裂。
- 先对高风险模块建立硬阈值，再逐步扩展，而不是一开始搞全仓统一硬指标。

## 截止日期

- 无硬性截止日期；当前阶段进入 spec 和后续 implementation plan 编写。

## 决策背后动机

- `verify-repo` 继续代表仓库 full gate，coverage 独立为更重的质量评估层。
- 前端高风险域固定为 `agent-flow` 与 `settings`，后端高风险 crate 固定为 `control-plane`、`storage-pg`、`api-server`。
- GitHub Actions 只负责环境准备与调度，不重复定义仓库脚本的内部命令逻辑。
- warning 仍然只输出到 `tmp/`，不升级为第三阶段的阻塞条件。

## 当前冻结的决定

- 新增 `scripts/node/verify-coverage.js`，支持 `frontend/backend/all`。
- 新增 `scripts/node/verify-ci.js`，顺序执行 `verify-repo` 和 `verify-coverage all`。
- 新增共享 coverage 阈值配置文件，统一维护目标范围、阈值和输出路径。
- 前端 coverage 首版阈值：
  - `agent-flow`：`lines/functions/statements >= 70`，`branches >= 55`
  - `settings`：`lines/functions/statements >= 65`，`branches >= 50`
- 后端 coverage 首版阈值：
  - `control-plane >= 70`
  - `storage-pg >= 65`
  - `api-server >= 60`
- GitHub Actions 首版新增 `.github/workflows/verify.yml`，触发 `pull_request` 和 `push main`。
- workflow 只调用 `node scripts/node/verify-ci.js`，并上传 `tmp/test-governance/` 产物。
