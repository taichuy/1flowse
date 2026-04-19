# 1flowbase CI And Coverage Design

## 背景

截至 `2026-04-19`，仓库已经完成测试分层第一阶段和第二阶段：

- 本地入口已经固定为 `fast / full / runtime-gate` 三层。
- `scripts/node/test-scripts.js`、`scripts/node/test-frontend.js`、`scripts/node/test-backend.js`、`scripts/node/verify-backend.js`、`scripts/node/verify-repo.js` 已经可以在仓库内统一执行。
- warning 已经统一落到 `tmp/test-governance/`，并且当前阶段不阻塞测试治理推进。

当前缺口只剩两块：

1. 仓库内还没有 coverage 规则与 coverage 执行入口。
2. 仓库内还没有正式的 CI 工作流，外部流水线与仓库命令没有收口到同一套语义。

## 目标

第三阶段需要把 coverage 与 CI 收口成仓库内正式能力，并且保持和前两阶段一致的命令心智：

- 本地和 CI 使用同一套 `scripts/node/*` 入口。
- coverage 只覆盖高风险模块，不引入全仓统一硬阈值。
- `verify-repo` 继续代表“仓库级 full gate”，coverage 单独成为更重的质量评估层。
- GitHub Actions 只编排仓库脚本，不重复写一套平行逻辑。

## 决策摘要

### 1. coverage 不并入 `verify-repo`

`verify-repo` 继续只负责：

- `scripts/node` 测试
- 前端 `full gate`
- 后端 `verify-backend`

coverage 单独放进新的 `verify-coverage` 入口，避免把本地全量验证命令变成过重的常用命令。

### 2. coverage 规则单独集中配置

新增一个共享配置文件，负责定义：

- coverage 报告输出目录
- 前端高风险域及阈值
- 后端高风险 crate 及阈值

所有仓库级脚本和 CI workflow 只读取这份配置，不在 README、脚本和 workflow 中重复硬编码阈值。

### 3. 前端 coverage 只看高风险页面域

前端 coverage 首版只评估：

- `web/app/src/features/agent-flow/**`
- `web/app/src/features/settings/**`

阈值首版为：

| 模块 | lines | functions | statements | branches |
| --- | --- | --- | --- | --- |
| `agent-flow` | 70 | 70 | 70 | 55 |
| `settings` | 65 | 65 | 65 | 50 |

原因：

- `agent-flow` 是前端目前最复杂、最容易产生回归的交互域。
- `settings` 承载权限、模型供应商、成员与角色等高风险后台配置能力。
- 首版阈值需要足够约束质量，但不应高到逼迫一次性清理所有历史缺口。

### 4. 后端 coverage 只看高风险 crate

后端 coverage 首版只评估：

- `control-plane`
- `storage-pg`
- `api-server`

阈值首版只设置行覆盖率：

| crate | line coverage |
| --- | --- |
| `control-plane` | 70 |
| `storage-pg` | 65 |
| `api-server` | 60 |

原因：

- `control-plane` 对应 service 层，是状态机和业务一致性的核心写入口。
- `storage-pg` 对应 repository 层，是事务、唯一性、作用域和持久化一致性的主要边界。
- `api-server` 对应 route 层，是接口契约、鉴权和路由行为的主要风险面。
- 首版只盯行覆盖率可以先把评估建立起来，避免一开始就被函数/分支维度的噪音拖慢推进。

### 5. GitHub Actions 只调仓库脚本

新增仓库级 CI wrapper：

- `node scripts/node/verify-ci.js`

其职责固定为：

1. 执行 `node scripts/node/verify-repo.js`
2. 执行 `node scripts/node/verify-coverage.js all`

新增 GitHub Actions workflow：

- `.github/workflows/verify.yml`

workflow 只负责：

- 安装 Node、pnpm、Rust
- 安装 `cargo-llvm-cov`
- 执行 `node scripts/node/verify-ci.js`
- 上传 `tmp/test-governance/` 和 coverage 产物

workflow 不自行重复实现 lint、test、coverage 命令细节。

## 文件设计

### 新增文件

- `scripts/node/testing/coverage-thresholds.js`
  - 统一维护前后端 coverage 目标、阈值和报告目录。
- `scripts/node/verify-coverage.js`
  - coverage 统一入口，支持 `frontend`、`backend`、`all`。
- `scripts/node/verify-coverage/_tests/cli.test.js`
  - 覆盖 coverage 入口的参数解析、命令拼装和阈值校验路径。
- `scripts/node/verify-ci.js`
  - 仓库级 CI 总入口，顺序执行 `verify-repo` 和 `verify-coverage all`。
- `scripts/node/verify-ci/_tests/cli.test.js`
  - 覆盖 CI wrapper 的命令编排。
- `.github/workflows/verify.yml`
  - 仓库内 GitHub Actions 校验工作流。

### 修改文件

- `README.md`
  - 补充 coverage 和 CI 入口说明。
- `web/app/package.json`
  - 补充前端 coverage script。
- `web/app/vite.config.ts`
  - 挂接 Vitest coverage provider 与 coverage reporter 输出配置。
- `web/package.json`
  - 暴露对等的 frontend coverage 入口。

## 覆盖率实现设计

### 前端 coverage 设计

前端 coverage 继续使用 Vitest，不引入第二套测试器。

新增依赖：

- `@vitest/coverage-v8`

coverage 运行方式：

- 在 `web/app` 下运行 Vitest coverage。
- 覆盖率报告至少输出：
  - `json-summary`
  - `text-summary`
  - `html`

报告目录固定到：

- `tmp/test-governance/coverage/frontend/`

前端 coverage gate 的职责不是简单看 Vitest 全局 total，而是读取 `json-summary` 并按路径前缀聚合：

- `src/features/agent-flow/`
- `src/features/settings/`

只有这两组模块会被纳入阈值判断；其余文件即使被测试覆盖，也不会进入第三阶段的硬阈值计算。

这样可以避免：

- 因为低风险模块没有 coverage 而拉低全局总分；
- 因为一个总阈值而误伤当前治理范围之外的区域。

### 后端 coverage 设计

后端 coverage 使用 `cargo llvm-cov`，不引入 `tarpaulin`。

原因：

- `cargo llvm-cov` 与当前 Rust workspace 更匹配；
- 与 GitHub Actions 的 Ubuntu 环境适配更直接；
- 首版实现可以按 package 独立执行并直接读取 summary 结果。

后端 coverage gate 会按 package 单独执行三次：

- `cargo llvm-cov -p control-plane`
- `cargo llvm-cov -p storage-pg`
- `cargo llvm-cov -p api-server`

每次执行都输出 JSON summary 到：

- `tmp/test-governance/coverage/backend/control-plane.json`
- `tmp/test-governance/coverage/backend/storage-pg.json`
- `tmp/test-governance/coverage/backend/api-server.json`

阈值校验只读取各 package 的行覆盖率 summary，不尝试在首版做 workspace 级按文件聚合。

这样做的取舍是明确的：

- 会比一次 workspace coverage 更重；
- 但 package 语义清晰，实现简单，阈值判断不会依赖复杂的 JSON 聚合逻辑；
- 更适合作为第三阶段的第一版基线。

### coverage 日志与输出

coverage 仍然沿用 `tmp/test-governance/` 作为总输出根目录：

- warning log：继续由共享 runner 统一写入
- coverage 报告：写入 `tmp/test-governance/coverage/`

第三阶段不会把 warning 升级为阻塞项，也不会要求 coverage 清理所有 warning 后才能通过。

## CI 设计

### 触发条件

GitHub Actions workflow 首版触发：

- `pull_request`
- `push` 到 `main`

不在第三阶段内加入 nightly 或 release 专用 `runtime-gate` workflow。

原因：

- `runtime-gate` 对运行时环境和服务启动方式有额外要求；
- 当前第三阶段的主目标是 coverage 与 CI 收口，不是运行态烟测编排。

### Job 结构

首版保持单 job：

- `verify`

job 顺序：

1. checkout
2. setup Node 22
3. setup pnpm / 安装前端依赖
4. setup Rust stable
5. 安装 `cargo-llvm-cov`
6. 执行 `node scripts/node/verify-ci.js`
7. 上传 artifact

artifact 至少包含：

- `tmp/test-governance/**`

这样失败时可以直接下载：

- warning log
- coverage summary
- HTML coverage 报告

## 非目标

第三阶段明确不做以下内容：

- 不把 warning 升级成阻塞项。
- 不为全部前端 package 或全部 Rust crate 设置统一 coverage 阈值。
- 不新增 nightly 或 release 专用 `runtime-gate` workflow。
- 不清理现有 Ant Design、React `act(...)` 等 warning。
- 不重构现有 `verify-repo` 语义。

## 验收标准

第三阶段完成后，仓库需要满足以下结果：

1. 本地可以执行：
   - `node scripts/node/verify-coverage.js frontend`
   - `node scripts/node/verify-coverage.js backend`
   - `node scripts/node/verify-coverage.js all`
   - `node scripts/node/verify-ci.js`
2. coverage 只对以下对象做硬阈值校验：
   - 前端：`agent-flow`、`settings`
   - 后端：`control-plane`、`storage-pg`、`api-server`
3. GitHub Actions 可以直接复用仓库脚本完成 full gate + coverage gate。
4. 所有 warning 和 coverage 报告都能在 `tmp/test-governance/` 下定位到。
5. README 对本地和 CI 的命令心智保持一致，不出现“仓库文档一套、workflow 另一套”的分裂。
