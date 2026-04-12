# 文档计划审计优化报告

日期：`2026-04-13 02`

## Scope

- 当前评估模式：`project evaluation mode`
- 评估范围：`docs/superpowers`、`docs/userDocs`、`api/`、`web/`
- 输入来源：
  - `docs/userDocs/AGENTS.md`
  - `docs/userDocs/user-memory.md`
  - `docs/userDocs/feedback-memory/interaction/2026-04-12-memory-summary-first-selection.md`
  - `docs/userDocs/feedback-memory/interaction/2026-04-12-no-extra-confirmation-when-explicit.md`
  - `docs/userDocs/project-memory/2026-04-12-auth-team-backend-implemented.md`
  - `docs/userDocs/project-memory/2026-04-12-backend-kernel-quality-plan-stage.md`
  - `docs/userDocs/project-memory/2026-04-12-qa-skill-backend-alignment.md`
  - `docs/superpowers/specs/1flowse/README.md`
  - `docs/superpowers/specs/1flowse/modules/README.md`
  - `docs/superpowers/specs/1flowse/2026-04-12-memory-retrieval-and-summary-design.md`
  - `docs/superpowers/specs/1flowse/2026-04-12-qa-evaluation-skill-design.md`
  - `docs/superpowers/plans/2026-04-12-auth-team-access-control-backend.md`
  - `docs/superpowers/plans/2026-04-12-backend-kernel-and-quality-alignment.md`
  - `docs/superpowers/plans/2026-04-12-userdocs-memory-retrieval-alignment.md`
  - `docs/superpowers/plans/2026-04-12-qa-evaluation-skill.md`
  - `api/`、`web/` 当前实现与验证命令结果
- 已运行的验证：
  - `date '+%F %H:%M:%S %z'`：当前审计时间为 `2026-04-13 02:02:30 +0800`
  - `find docs/userDocs -maxdepth 2 -type f | sort`：`docs/userDocs` 当前只保留记忆主文件、四类记忆目录、`todolist`
  - `find docs/qa-report -maxdepth 2 -type f | sort`：当前只有 `docs/qa-report/document-plan-audit.md`
  - `cd web && pnpm lint`：通过
  - `cd web && pnpm test`：失败，`web/app/src/app/App.test.tsx` 的 mock 缺少 `getDefaultApiBaseUrl`
  - `cd web && pnpm build`：通过，但产物主 chunk `877.94 kB`
  - `cd api && cargo fmt --check`：通过
  - `cd api && cargo clippy --all-targets --all-features -- -D warnings`：失败，命中 `clippy::new_without_default`
  - `cd api && cargo test`：沙箱内失败，`apps/api-server/src/_tests/support.rs:37` 访问本机依赖时报 `Operation not permitted`
  - 提权后 `cd api && cargo test`：通过，全量后端测试与 doctest 通过
- 未运行的验证：
  - 真实浏览器端主路径手工流程
  - 小屏 / 响应式回归
  - OpenAPI 页面与前端联调
  - `docs/superpowers` 各模块逐条需求验收

## Conclusion

- 是否存在 `Blocking` 问题：有。`docs/superpowers` 目前不能再被当作“当前执行真相”的单一入口使用。
- 是否存在 `High` 问题：有，主要是文档追踪口径漂移和前端测试基线失真。
- 当前是否建议继续推进：建议有限推进。先修文档追踪层与验证门禁，再继续扩 backend foundation 或前端主路径。
- 当前最主要的风险：离线查看文档时会同时收到“模块已完成”“计划未执行”“代码部分已落地”三种互相冲突的信号，导致排期和 QA 结论失真。

## 1. 现状

### 1.1 文档现状

- `docs/userDocs` 的记忆检索模型基本已经落地：
  - `docs/userDocs/AGENTS.md` 已明确“先读 AGENTS + user-memory，再读 YAML 摘要，最多展开 5 条有效记忆”。
  - `tool-memory` 已建立，`reference-memory/AGENTS.md` 也明确了只做索引不做结论。
  - 当前 `docs/userDocs` 顶层结构已经比较干净，没有重新长出旧的杂项文档入口。
- `docs/qa-report` 与 `docs/userDocs/todolist` 已经形成唯一滚动入口，这是当前最健康的一部分。
- `docs/superpowers` 的问题不在“没有文档”，而在“文档入口、模块状态、执行计划三套口径没有同步”：
  - 根 `README` 仍不是完整索引。
  - 模块总览仍用单列 `状态`。
  - 多份 plan 的勾选状态没有随着实际落地同步。

### 1.2 代码现状

- 后端 `auth / team / member / role / permission` 主干是真实可用的：
  - 提权后 `cargo test` 全绿，说明当前 auth/team slice 的功能回归成立。
- 后端 foundation 仍大幅落后于文档规划：
  - `api/apps/api-server/src/lib.rs` 仍是扁平 console router。
  - `api/apps/api-server/src/routes/auth.rs` 仍是 `/api/console/auth/login`。
  - `api/crates/runtime-core/src/lib.rs` 与 `api/crates/plugin-framework/src/lib.rs` 仍只有 `crate_name()`。
  - `api/crates/storage-pg/src/repositories.rs` 仍是 `1266` 行集中实现。
- 前端仍停留在 bootstrap/shell 阶段：
  - 根壳标题仍是 `1Flowse Bootstrap`。
  - 首页仍以 health/bootstrap 信息为主。
  - `agentFlow` 和 `Embedded Apps` 仍是占位页。

### 1.3 验证现状

- 前端：
  - `lint` 通过，说明基础静态规范还在。
  - `build` 通过，但 `dist/assets/index-C4xoSpad.js` 达到 `877.94 kB`，后续需要关注拆包。
  - `test` 仍失败，但失败点还是测试装置，不是业务逻辑直接崩：
    - `App.test.tsx` 只 mock 了 `fetchApiHealth`
    - `HomePage` 已依赖 `getDefaultApiBaseUrl(window.location)`
    - 根路由测试因此掉进错误边界页
- 后端：
  - `fmt` 通过。
  - `clippy -D warnings` 不通过，工程质量门禁未闭环。
  - `cargo test` 的默认失败是环境限制，提权后真实结果是全绿。

## Findings

### [High] `docs/superpowers` 已不能作为当前执行真相的可靠入口

- 位置：
  - `docs/superpowers/specs/1flowse/README.md:5`
  - `docs/superpowers/specs/1flowse/modules/README.md:33`
  - `docs/superpowers/plans/2026-04-12-auth-team-access-control-backend.md:121`
  - `docs/superpowers/plans/2026-04-12-userdocs-memory-retrieval-alignment.md:21`
  - `docs/superpowers/plans/2026-04-12-qa-evaluation-skill.md:37`
- 证据：
  - `docs/superpowers/specs/1flowse/README.md` 的文档列表只列到 `2026-04-12-backend-engineering-quality-design.md`，没有把同目录下已经存在的 `2026-04-12-auth-team-access-control-backend-design.md`、`2026-04-12-frontend-visual-baseline-and-skill-evolution-design.md`、`2026-04-12-memory-retrieval-and-summary-design.md`、`2026-04-12-qa-evaluation-skill-design.md` 纳入索引。
  - `docs/superpowers/specs/1flowse/modules/README.md` 仍用单列 `状态` 把 `03-08` 标成 `completed`。
  - `docs/superpowers/plans/2026-04-12-auth-team-access-control-backend.md` 全部还是未勾选，但对应代码和后端测试已经真实存在。
  - `docs/superpowers/plans/2026-04-12-userdocs-memory-retrieval-alignment.md` 也全部未勾选，但 `docs/userDocs` 结构、YAML 摘要和 `tool-memory` 已落地。
  - 同期的 `docs/superpowers/plans/2026-04-12-qa-evaluation-skill.md` 却已完整勾选，说明 plan 维护口径本身不一致。
- 为什么是问题：
  - 当前文档入口同时传达“规格遗漏”“模块完成”“计划未执行”“代码已落地”四类冲突信号。
  - 用户离线审阅或后续 agent 接手时，很难直接判断哪一层才是当前真相。
- 建议修正方向：
  - 把 `docs/superpowers/specs/1flowse/README.md` 补成完整索引。
  - 把模块总览至少拆成 `spec_status / implementation_status / verification_status`。
  - 已落地计划要同步勾选，或者补一层统一的 `execution_state`，不要再让 plan 的勾选状态长期失真。

### [High] 前端测试基线仍失真，`pnpm test` 不能可靠代表前端真实可用性

- 位置：
  - `web/app/src/app/App.test.tsx:4`
  - `web/app/src/app/App.test.tsx:21`
  - `web/app/src/features/home/HomePage.tsx:4`
  - `web/app/src/features/home/HomePage.tsx:9`
- 证据：
  - `App.test.tsx` 只 mock 了 `fetchApiHealth`。
  - `HomePage` 已直接依赖 `getDefaultApiBaseUrl(window.location)`。
  - `pnpm test` 实际报错为：`No "getDefaultApiBaseUrl" export is defined on the "@1flowse/api-client" mock`。
  - 测试输出显示根路由渲染进了 `Something went wrong!` 错误边界，因此“首页不可见”的失败结论是测试装置带出来的假失败。
- 为什么是问题：
  - 当前前端回归信号带噪声，任何正常的导出调整都可能被放大成整站红灯。
  - 这会降低每轮 QA 结论的可信度。
- 建议修正方向：
  - 把 mock 改为部分 mock，或显式补齐 `getDefaultApiBaseUrl`。
  - 保留真实路由渲染断言，但避免让错误边界掩盖原始失败原因。

### [Medium] 后端功能回归成立，但工程质量门禁仍未闭环

- 位置：
  - `api/crates/control-plane/src/auth.rs:68`
  - 验证命令：`cd api && cargo clippy --all-targets --all-features -- -D warnings`
- 证据：
  - `cargo fmt --check` 通过。
  - 提权后 `cargo test` 全量通过。
  - `cargo clippy` 仍报 `AuthenticatorRegistry::new()` 触发 `clippy::new_without_default`，建议补 `Default`。
- 为什么是问题：
  - 当前后端可以说“功能回归成立”，但不能说“质量门禁已全绿”。
  - 只要 `clippy -D warnings` 仍是正式门禁，这个缺口就会持续污染后续审计。
- 建议修正方向：
  - 给 `AuthenticatorRegistry` 补 `Default`，恢复 `clippy` 绿灯。
  - 后续继续在报告中明确区分“沙箱受限”和“真实代码失败”。

### [Medium] backend foundation 与当前代码仍存在明显文档到实现落差

- 位置：
  - `api/apps/api-server/src/lib.rs:113`
  - `api/apps/api-server/src/lib.rs:126`
  - `api/crates/runtime-core/src/lib.rs:1`
  - `api/crates/plugin-framework/src/lib.rs:1`
  - `api/crates/storage-pg/src/repositories.rs:1`
  - `docs/superpowers/plans/2026-04-12-backend-kernel-and-quality-alignment.md:122`
- 证据：
  - API 入口仍是扁平 `base_router + console_router`，没有进入 plan 里要求的 `public auth / session / resource kernel / runtime` 路由结构。
  - 登录接口仍是 `/api/console/auth/login`，尚未切到 public provider path。
  - `runtime-core`、`plugin-framework` 当前还是占位 crate。
  - `storage-pg/src/repositories.rs` 仍是单文件大实现。
  - backend-kernel plan 的任务仍全部未勾选。
- 为什么是问题：
  - 当前 auth/team slice 可以工作，但继续往 runtime/modeling/plugin 扩张时，会把新能力继续压进旧结构。
  - 这和已确认的 backend interface/kernel/quality 文档方向持续背离。
- 建议修正方向：
  - 下一步只执行 backend-kernel plan 的 Task 1 与 Task 2。
  - 在 `ApiSuccess / public auth / session / router` 与 `repository + mapper` 没落地前，不继续扩新的 runtime/modeling/plugin 面。

### [Medium] 前端仍缺一条可真实验收的主路径

- 位置：
  - `web/app/src/app/router.tsx:21`
  - `web/app/src/features/home/HomePage.tsx:19`
  - `web/app/src/features/agent-flow/AgentFlowPage.tsx:7`
  - `web/app/src/features/embedded-apps/EmbeddedAppsPage.tsx:12`
- 证据：
  - 根壳仍是 `1Flowse Bootstrap`。
  - 首页仍是 `Workspace Bootstrap` + `API Health`。
  - `agentFlow` 仍写着 “Editor shell reserved for the next implementation slice.”
  - `Embedded Apps` 仍是 placeholder 管理面。
- 为什么是问题：
  - 模块 03/04 的文档已经非常完整，但前端目前还没有最小真实主路径承接这些规格。
  - 前端 QA 还只能验证壳层，而不是产品路径。
- 建议修正方向：
  - 先只做一条最小真实主路径：`工作台列表 -> 应用概览 -> 进入 agentFlow shell`。
  - 如果短期不做，应把文档状态明确标为“设计完成、实现未开始”。

## 2. 可改进方向、预期结果、好处与风险

| 方向 | 预期结果 | 好处 | 风险 / 代价 |
| --- | --- | --- | --- |
| 建立 `docs/superpowers` 执行真相层 | 根索引、模块状态、计划勾选能表达同一事实 | 离线查看、排期、QA 口径统一 | 需要回补已有 plan 和模块表述，短期是纯文档工作 |
| 修复验证门禁 | `web` 测试与 `api` clippy 恢复可信 | 每轮审计可快速区分真实回归与装置噪声 | 会占掉一轮不扩新功能的时间 |
| 先补 backend foundation 前两块 | API 包装、session、router、repository/mapper 先稳定 | 后续 runtime/modeling/plugin 能在正确边界上继续长 | 当前业务面新增速度会暂时变慢 |
| 前端只落一条最小真实主路径 | 至少有一条工作台到 agentFlow 的真实验收链路 | 前端 QA 开始从“壳层”转向“产品路径” | 需要压缩 embedded 和其他占位面的并行范围 |
| 保持唯一滚动审计入口 | 每轮只更新当前报告和待办，不再分叉 | 用户离线查看成本最低，旧结论更容易被直接替换 | 要持续删除或改写旧结论，不能偷懒只追加 |

## 3. 明确建议

1. 先修 `docs/superpowers` 的执行真相层，再继续扩模块文档或新域实现。
2. 这一轮文档层建议优先做三件事：
   - 补全 `docs/superpowers/specs/1flowse/README.md` 索引
   - 把 `modules/README.md` 改成双轨或三轨状态
   - 同步已落地 plan 的执行状态
3. 工程层建议先恢复两个门禁：
   - `web/app/src/app/App.test.tsx` 的 mock
   - `api/crates/control-plane/src/auth.rs` 的 `Default`
4. 在上述两类问题没处理前，不建议继续推进新的 runtime / plugin / state model 细节落地。
5. `docs/userDocs` 当前结构基本对齐，不建议再改目录模型；后续重点放在维持稳定和继续使用，而不是再做结构性重写。

## Uncovered Areas / Risks

- 本轮没有逐页打开前端做人工交互和响应式验证，因此 UI 一致性结论仍以代码结构层为主。
- 本轮没有逐条对照 `docs/superpowers/modules` 每一条需求，只抓了“入口索引、状态口径、关键实现”这几个最影响判断的断点。
- `cargo test` 在沙箱内失败是环境限制，不应误判成代码回归；本轮已通过提权复核真实结果。
- 本轮按用户要求仅更新 `docs/qa-report` 与 `docs/userDocs/todolist`，没有直接回写 `docs/superpowers`、`web/`、`api/` 或 `tool-memory`。
