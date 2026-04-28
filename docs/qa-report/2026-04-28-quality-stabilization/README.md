# 1flowbase 架构稳定与质量降熵执行总报告

更新时间：`2026-04-28`

评估模式：`qa-evaluation / task mode`

## 1. 总目标

本轮目标是维护架构稳定、降低隐式耦合、清理质量门禁漂移，并提升开发回归速度。

本轮不以新增产品功能为目标，而以以下质量目标为主：

- 明确 Agent Flow 编辑器初始态与节点详情态边界。
- 拆开页面级 style-boundary 与组件级 style-boundary。
- 修正后端 runtime 输出契约与 observability 参数边界。
- 调整仓库验证门禁分层，避免开发回归被 coverage 过度拖慢。
- 清理前端 lint warning，让 lint 可进入 `--max-warnings=0` 收敛。
- 处理 Vite 主 chunk 超阈值问题，降低入口业务 chunk 体积并保留重型依赖的 lazy 边界。

## 2. 专题报告索引

| 编号 | 报告 | 状态 | 结论 |
| --- | --- | --- | --- |
| N1 | [Agent Flow 默认选中与测试显式化](./N1-agent-flow-selection-and-tests.md) | 已执行 | 解除测试对默认选中节点的隐式依赖 |
| N2 | [Style Boundary 拆分](./N2-style-boundary-split.md) | 已执行 | 页面初始态与节点详情态已拆开 |
| N3 | [后端 Runtime 契约与 Observability](./N3-backend-runtime-observability.md) | 已执行 | runtime 输出与 span 写入边界更稳定 |
| N4 | [验证门禁编排](./N4-verification-gate-orchestration.md) | 已执行 | repo gate 与 CI coverage 分层 |
| N5 | [前端 Lint Warning 清零](./N5-frontend-lint-warning-zero.md) | 已执行 | app lint 已可 0 warning 通过 |
| N6 | [Vite 主 Chunk 优化执行](./N6-vite-main-chunk-optimization.md) | 已执行 | route/section/component lazy 与 vendor chunks 已落地 |
| N7 | [残留噪声与下一轮质量债](./N7-residual-noise-and-next-quality-debt.md) | 已收口 | 前端 stderr 噪声与 coverage frontend 已收口 |

## 3. 已完成改动摘要

### 3.1 前端 Agent Flow

- `createAgentFlowEditorStore` 初始化不默认选择任何节点。
- 需要节点详情的测试显式写入 `selectedNodeId / selectedNodeIds`。
- Debug console trace linkage 测试改为显式选择 LLM / Answer 节点。
- 节点详情 style-boundary 新增独立组件场景。
- `LlmCardModelBadge` 从 renderer registry 移到组件文件，消除 fast-refresh warning。
- `syncSelectedNode` 改为稳定 callback，消除 hook dependency warning。

### 3.2 Style Boundary

- `page.application-detail` 不再承担节点详情 dock 的断言。
- 新增 `component.agent-flow-node-detail`，由场景显式选中 `node-llm` 后验证节点详情。

### 3.3 后端

- orchestration runtime 不再无条件输出 `structured_output: null`。
- `append_host_span` 改为接收 `AppendHostSpanInput`，降低参数耦合。
- 修复 clippy 暴露的复杂类型和嵌套 `if` 问题。
- 修复 `plugin-runner` provider route 测试临时目录并发碰撞风险。

### 3.4 验证脚本

- `verify-repo` 不再包含 `coverage all`。
- `verify-ci` 改为 `verify-repo + verify-coverage all`。
- `test-backend --help` 不再误触发后端重门禁。

### 3.5 Vite Chunk 与前端噪声

- `ApplicationDetailPage`、`SettingsPage` 改为 route lazy。
- `AgentFlowEditorPage`、`ApplicationLogsPage`、`ApiDocsPanel`、`SettingsFilesSection`、`SettingsModelProvidersSection` 改为 section lazy。
- `NodeRunIOCard` 的 Monaco JSON viewer 改为组件级 lazy。
- `vite.config.ts` 增加 `react-vendor`、`antd-vendor`、`flow-vendor`、`monaco-vendor` 手工 chunk。
- 前端测试环境补齐 JSDOM 尺寸与滚动 fallback，收敛历史 stderr warning。

## 4. 验证证据

本轮已执行并通过：

- `pnpm --dir web/app exec eslint src --ext .ts,.tsx --max-warnings=0`
- `pnpm --dir web/app build`
  - 入口业务 chunk `dist/assets/index-*.js` 约 `94.52 kB minified / 18.46 kB gzip`
  - `AgentFlowEditorPage-*.js` 约 `320.43 kB minified / 64.26 kB gzip`
  - `ApiDocsPanel-*.js` 约 `2,931.24 kB minified / 861.97 kB gzip`，已隔离为 docs lazy chunk
  - build 输出无 Vite `Some chunks are larger than 500 kB` 警告
- `node scripts/node/test-contracts.js`
  - `3` files passed
  - `27` tests passed
- `pnpm --dir web/app test ...`
  - 实际执行完整 app Vitest
  - `61` files passed
  - `230` tests passed
- `node scripts/node/check-style-boundary.js component component.agent-flow-node-detail`
- `node scripts/node/test-frontend.js full`
- `node scripts/node/verify.js coverage frontend`
  - `65` files passed
  - `289` tests passed
  - Statements `76.57%`
  - Branches `77.44%`
  - Functions `70.54%`
  - Lines `76.57%`
  - frontend coverage thresholds passed
- `node scripts/node/test-scripts.js`
  - `176` tests passed
- `cargo fmt --all --check`
- `cargo check --workspace --jobs 2`
- `cargo clippy --workspace --all-targets --jobs 2 -- -D warnings`
- `cargo test --workspace --jobs 2 -- --test-threads=2`

本轮仍未执行：

- `node scripts/node/verify-coverage.js all`
- `node scripts/node/verify-ci.js`

未执行原因：本轮新增收口了 frontend coverage；完整 `coverage all` 与 `verify-ci` 仍包含更重的全仓库 CI 预算，保留为发布前门禁，不作为本轮开发回归完成条件。

## 5. 当前风险结论

Blocking：无已知阻断。

High：无已知高危回归。

Medium：无本轮已知中风险遗留。

Low：

- 完整 `verify-ci` 与 `coverage all` 尚未在本轮实跑，发布前仍需单独执行。
- `ApiDocsPanel` 仍是体积最大的 lazy chunk，主要来自 Scalar 文档渲染链路；当前已从入口隔离，后续可继续做 Scalar 局部加载或替代方案评估。

## 6. 后续建议

建议下一阶段按以下顺序推进：

1. 发布前执行 `node scripts/node/verify-ci.js`。
2. 若继续压缩文档页首开成本，优先分析 `ApiDocsPanel` / Scalar 链路。
3. 建议新增 bundle stats 产物到 `tmp/test-governance/`，用于后续性能预算对比。
