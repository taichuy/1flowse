# 文档计划审计优化报告

日期：`2026-04-14 07`

说明：本文件为滚动版本，覆盖 `2026-04-14 06` 的同主题旧结论。本轮不重复旧报告里已经成立的泛化判断，重点用新证据替换两类旧口径：

- 前端当前的主要问题，不再是“结构还没拆开”，而是“结构整改已完成，但更晚确认的正式控制台方案还没有进入实现闭环”。
- 当前最失真的也不只是“文档太多”，而是“文档生命周期、模块状态和前端语义真相层彼此脱节”。

## Scope

- 当前评估模式：`project evaluation mode`
- 评估范围：
  - `docs/superpowers`
  - `docs/userDocs`
  - `docs/qa-report`
  - `api/`
  - `web/`
  - `scripts/node/check-style-boundary.js`
  - `scripts/node/verify-backend.js`
- 输入来源：
  - 记忆：
    - `.memory/AGENTS.md`
    - `.memory/user-memory.md`
    - `.memory/project-memory/2026-04-12-backend-quality-spec-scope.md`
    - `.memory/project-memory/2026-04-13-backend-governance-phase-two-direction.md`
    - `.memory/project-memory/2026-04-13-backend-kernel-quality-implemented.md`
    - `.memory/project-memory/2026-04-13-frontend-bootstrap-realignment-plan-stage.md`
    - `.memory/project-memory/2026-04-13-frontend-qa-current-state.md`
  - 文档：
    - `docs/superpowers/specs/1flowse/README.md`
    - `docs/superpowers/specs/1flowse/modules/README.md`
    - `docs/superpowers/specs/1flowse/modules/*/README.md`
    - `docs/superpowers/specs/1flowse/2026-04-13-console-shell-auth-settings-design.md`
    - `docs/superpowers/plans/2026-04-13-frontend-bootstrap-realignment.md`
    - `docs/userDocs/todolist/document-plan-audit.md`
  - 代码：
    - `web/app/src/routes/route-config.ts`
    - `web/app/src/app-shell/AppShellFrame.tsx`
    - `web/app/src/app-shell/Navigation.tsx`
    - `web/app/src/features/home/pages/HomePage.tsx`
    - `web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx`
    - `web/app/src/features/embedded-apps/pages/EmbeddedAppDetailPage.tsx`
    - `web/app/src/features/embedded-runtime/pages/EmbeddedMountPage.tsx`
    - `web/app/src/features/agent-flow/pages/AgentFlowPage.tsx`
    - `web/app/src/app/_tests/app-shell.test.tsx`
    - `web/app/src/routes/_tests/route-config.test.ts`
    - `web/app/src/routes/_tests/route-guards.test.tsx`
    - `api/crates/publish-gateway/src/lib.rs`
    - `api/apps/plugin-runner/src/lib.rs`
    - `api/crates/plugin-framework/src/assignment.rs`
    - `api/crates/runtime-core/src/runtime_engine.rs`
    - `api/crates/storage-pg/src/model_definition_repository.rs`
- 已运行的验证：
  - `date '+%Y-%m-%d %H:%M:%S %z'`：`2026-04-14 07:02:05 +0800`
  - `pnpm --dir web lint`：通过
  - `pnpm --dir web test -- --testTimeout=15000`：通过
    - `web/app`：`10` 个测试文件、`19` 个用例通过
    - `embed-sdk`：`1` 个测试文件、`1` 个用例通过
    - `embedded-contracts`：`1` 个测试文件、`1` 个用例通过
    - 当前实际无测试文件但以 `passWithNoTests` 通过的 package：`api-client`、`flow-schema`、`page-protocol`、`page-runtime`、`shared-types`、`ui`
    - 当前 `package.json` 中带 `passWithNoTests` 配置的 package：共 `8` 个
  - `pnpm --dir web/app build`：通过
    - `dist/assets/index-n9-QTwmx.js`：`1,184.41 kB`
    - Vite 仍给出 chunk size warning
  - `node scripts/node/check-style-boundary.js all-pages`：
    - 沙箱内首次失败：`frontend 启动超时`
    - 根因证据：`tmp/logs/web.log` 显示 `listen EPERM: operation not permitted 0.0.0.0:3100`
    - 提权复跑通过：`PASS page.home`、`PASS page.embedded-apps`、`PASS page.agent-flow`
  - `node scripts/node/verify-backend.js`：
    - 沙箱内首次失败：`api/apps/api-server/src/_tests/support.rs:37` 报 `Operation not permitted`
    - 提权复跑通过：后端统一验证脚本退出 `0`
    - 关键通过项：
      - `api-server`：`19` 个库内测试 + `3` 个路由测试通过
      - `control-plane`：`14` 个测试通过
      - `runtime-core`：`6` 个测试通过
      - `storage-pg`：`12` 个测试通过
      - `plugin-framework`：`3` 个测试通过
- 未运行的验证：
  - 真实浏览器登录、退出、改密、个人资料、团队设置主路径
  - 移动端人工回归
  - `publish-gateway` 与 `plugin-runner` 端到端联调
  - 用户视角的 `docs/userDocs` 消费性验证

## Conclusion

- 是否存在 `Blocking` 问题：未发现被当前代码和验证结果直接证明的 `Blocking` 问题
- 是否存在 `High` 问题：有，集中在文档生命周期、模块状态表达和前端下一步真相层
- 当前是否建议继续推进：建议继续推进，但不建议继续为同主题平铺新增顶层文档
- 当前最主要的风险：项目真实成熟度正在被“完成状态写法”和“通过的过渡态测试”高估

## 本轮比上一版更准确的结论

- 前端目录和测试布局已经收敛到 `app-shell / routes / features / _tests`，旧版里“结构还没成形”的表述应废弃。
- `embedded-apps` 页面已经不是纯 placeholder，它有正式中文文案和专门测试；但首页、壳层标题、附属路由和测试仍保留 bootstrap 语义。
- 当前前端的核心问题不是“有没有计划”，而是：
  - `2026-04-13-frontend-bootstrap-realignment.md` 已执行完成
  - `2026-04-13-console-shell-auth-settings-design.md` 又定义了更晚、更正式的目标
  - 代码和测试仍停留在前一个过渡态

## 1. 当前现状

### 1.1 代码现状

- 后端：
  - `auth / session / team / member / role / permission / state model / runtime data` 已有真实代码和统一验证支撑。
  - `runtime-core`、`control-plane`、`storage-pg` 都不是空骨架，且测试覆盖有效。
  - `publish-gateway` 仍只剩 `crate_name()`，见 `api/crates/publish-gateway/src/lib.rs:1-3`。
  - `plugin-runner` 仍是健康检查壳层加地址解析，见 `api/apps/plugin-runner/src/lib.rs:8-61`。
- 前端：
  - 结构层已经完成一次实质性治理：
    - 路由真值层集中在 `web/app/src/routes/route-config.ts`
    - 壳层集中在 `web/app/src/app-shell`
    - 页面已经进入 `features/*/pages`
    - 测试已经进入最近的 `_tests`
  - 但语义层仍停在过渡态：
    - 壳层标题仍是 `1Flowse Bootstrap`
    - 首页仍展示 `Workspace Bootstrap / API Health`
    - 导航仍是 `工作台 / 团队 / 前台`
    - 路由仍保留 `agent-flow`、`embedded-runtime`、详情页和挂载页
    - 测试仍显式要求 `bootstrap-allow` 和 `bootstrap shell`
- 规模与压力：
  - `api + web` 非构建产物源码总行数约 `17303`
  - 当前测试文件数为 `55`
  - 最大热点文件仍是 `api/crates/storage-pg/src/model_definition_repository.rs`，`1181` 行

### 1.2 文档现状

- `docs/superpowers/specs/1flowse` 共有 `31` 个 Markdown，合计 `9454` 行。
- `docs/superpowers/plans` 共有 `16` 个 Markdown，合计 `11664` 行，已超过“单目录不超过 `15` 个文件”的项目约定。
- `docs/superpowers/specs/1flowse/README.md` 当前只索引 `10` 个入口，但目录下实际已有 `31` 个 Markdown。
- `docs/userDocs` 当前只有 `1` 个文件，而且仍是内部待办，不是用户侧现状入口。
- `docs/qa-report` 当前也只有 `1` 个滚动文件，尚未形成可分主题检索结构。

### 1.3 更准确的成熟度判断

- 模块 `01`：
  - 后端完成度最高，且当前验证最完整。
- 模块 `02`：
  - 仍应保持 `in_progress`，因为权限模型讨论与实现都还在继续扩展。
- 模块 `03/04`：
  - 当前更接近“前端结构和页面骨架存在，但正式控制台语义未收口”。
- 模块 `05/07`：
  - 后端基础能力比旧报告里更扎实，可以被称为“有真实实现基础”，但不宜直接等同于整个模块已完成。
- 模块 `06/08`：
  - 当前文档口径仍明显高于实现：
    - `publish-gateway` 还没有真正的发布链路
    - `plugin-runner` 和插件主链路还停留在基础壳层与约束验证

## Findings

### [High] `docs/superpowers` 缺少生命周期和入口契约，导致“设计、计划、执行结果”长期混放

- 位置：
  - `docs/superpowers/specs/1flowse/README.md`
  - `docs/superpowers/plans`
  - `docs/superpowers/plans/2026-04-13-frontend-bootstrap-realignment.md`
- 证据：
  - `specs/1flowse/README.md` 只列出 `10` 个入口，但目录中实际有 `31` 个 Markdown。
  - `plans` 目录已有 `16` 个文件，超过项目目录约定。
  - 当前有 `6` 个 plan 文件超过 `1000` 行，`2` 个超过 `1500` 行：
    - `2026-04-12-auth-team-access-control-backend.md`：`2967` 行
    - `2026-04-11-fullstack-bootstrap.md`：`1911` 行
  - `2026-04-13-frontend-bootstrap-realignment.md` 已写入 `Execution Result / Status: completed / Completed at`，但仍留在 `plans` 活动目录中。
- 为什么是问题：
  - 当前不是简单的“文档太多”，而是类型职责漂移。
  - 当 plan 同时承担“待执行计划”“执行流水”“完成留档”三种职责时，后续检索命中的先是历史步骤，而不是当前仍然有效的真相。
- 建议修正方向：
  - 固定 `specs / plans / qa-report / userDocs / modules` 的职责矩阵。
  - 给 `plans` 增加 `active / completed / archived` 生命周期。
  - 已完成 plan 只保留摘要、结果、证据链接；执行流水移到归档层或压缩为摘要。

### [High] 模块状态仍把“设计确认”写成“模块完成”，项目成熟度被系统性高估

- 位置：
  - `docs/superpowers/specs/1flowse/modules/README.md`
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
  - `docs/superpowers/specs/1flowse/modules/04-chatflow-studio/README.md`
  - `docs/superpowers/specs/1flowse/modules/06-publish-gateway/README.md`
  - `docs/superpowers/specs/1flowse/modules/08-plugin-framework/README.md`
  - `api/crates/publish-gateway/src/lib.rs`
  - `api/apps/plugin-runner/src/lib.rs`
- 证据：
  - 模块总览仍将 `01/03/04/05/06/07/08` 写为 `completed`。
  - `03/04/06/08` 的 README 里“完成情况”描述仍主要是“已确认、已定稿、获用户通过”。
  - `06` 对应代码当前仍只有 `crate_name()`。
  - `08` 对应代码虽有 `plugin-framework` 约束和 `plugin-runner` 健康壳层，但距离模块文档所描述的安装、激活、调用、升级、卸载链路还有明显距离。
- 为什么是问题：
  - 现在的 `completed` 同时混用了“讨论完成”“设计定稿”“骨架存在”“实现完成”“验证通过”几种含义。
  - 这会直接影响后续排期、对外沟通和你判断下一轮治理重点的准确性。
- 建议修正方向：
  - 把模块状态改成至少三轴：
    - `design_status`
    - `implementation_status`
    - `verification_status`
  - 每一轴都附证据入口：
    - spec / plan / code / verification command
  - 对 `05/07` 这类已有真实后端实现基础的模块，允许写“implementation partial / verification partial”，而不是只能在 `completed` 和 `in_progress` 间二选一。

### [High] 前端当前最大的失真，不是结构，而是“更晚确认的正式控制台方案”没有进入代码和测试真相层

- 位置：
  - `docs/superpowers/specs/1flowse/2026-04-13-console-shell-auth-settings-design.md`
  - `docs/superpowers/plans/2026-04-13-frontend-bootstrap-realignment.md`
  - `web/app/src/routes/route-config.ts`
  - `web/app/src/app-shell/AppShellFrame.tsx`
  - `web/app/src/features/home/pages/HomePage.tsx`
  - `web/app/src/features/embedded-apps/pages/EmbeddedAppDetailPage.tsx`
  - `web/app/src/features/embedded-runtime/pages/EmbeddedMountPage.tsx`
  - `web/app/src/app/_tests/app-shell.test.tsx`
  - `web/app/src/routes/_tests/route-config.test.ts`
  - `web/app/src/routes/_tests/route-guards.test.tsx`
- 证据：
  - `2026-04-13-frontend-bootstrap-realignment.md` 已标记 `Status: completed`。
  - 更晚的设计稿明确要求：
    - 删除 `agent-flow`、`embedded-runtime` 和详情页、挂载页
    - 顶部改为 `工作台 / 子系统 / 工具 / 设置`
    - 壳层标题改为 `1Flowse`
    - 首页移除 `Workspace Bootstrap / API Health`
  - 当前代码和测试仍显式固化旧语义：
    - `AppShellFrame` 标题仍为 `1Flowse Bootstrap`
    - `route-config.ts` 仍保留 `团队 / 前台 / embedded-runtime / agent-flow`
    - `HomePage` 仍保留 `Workspace Bootstrap / API Health`
    - `EmbeddedAppDetailPage` 仍使用 `placeholderManifest`
    - `EmbeddedMountPage` 仍写 `bootstrap-application / bootstrap-team`
    - 测试仍要求 `bootstrap-allow`、`passes children through in bootstrap mode`、`renders the bootstrap shell and health state`
- 为什么是问题：
  - 当前前端不是“没有文档”，而是“有两个连续阶段的文档，但代码和测试只锁定了前一个阶段”。
  - 这会让绿色测试在客观上继续保护过渡态，增加下一轮正式收口的改动阻力。
  - `docs/userDocs` 也无法判断到底哪个文档才是当前有效入口。
- 建议修正方向：
  - 先做一个决策，不要继续悬空：
    - 若 `2026-04-13-console-shell-auth-settings-design.md` 仍有效，就立刻转成唯一活动 plan
    - 若方向已变，就显式标注该设计稿为暂缓或废弃
  - 一旦进入执行，必须把 `route config / shell title / nav label / page copy / tests` 当成同一 slice 一次性收口，不能再零散改文案。

### [Medium] 当前 QA 绿灯需要按层解读，否则“工程通过”和“产品已就绪”会继续混写

- 位置：
  - `web/package.json`
  - `web/packages/*/package.json`
  - `scripts/node/check-style-boundary.js`
  - `scripts/node/verify-backend.js`
- 证据：
  - `lint / test / build / style-boundary / verify-backend` 这一轮都能通过。
  - 但 `style-boundary` 需要本地端口监听能力，`verify-backend` 需要本地权限或依赖，二者都不是纯沙箱命令。
  - 当前有 `8` 个 package 配置了 `passWithNoTests`，其中 `6` 个本轮实际确实没有测试文件。
  - `web/app build` 仍有 `1,184.41 kB` 主 chunk warning。
- 为什么是问题：
  - 这不说明工程门禁无效，恰恰说明工程门禁已经建立。
  - 真正的问题是：当前报告口径若不分层，就会把“静态门禁通过”“本机验证通过”“产品主路径已验证”写成同一个绿色结论。
- 建议修正方向：
  - 固定 QA 输出四层：
    - `static gates`
    - `sandbox-safe tests`
    - `local-service verification`
    - `manual product checks`
  - 为 `passWithNoTests` 建一张“补测或显式豁免”清单。
  - bundle warning 留在第二阶段处理，不要抢在真相层治理前面。

### [Medium] `docs/userDocs` 仍没有成为“用户离线回看项目状态”的入口

- 位置：
  - `docs/userDocs`
  - `docs/userDocs/todolist/document-plan-audit.md`
- 证据：
  - 当前 `docs/userDocs` 下只有 `1` 个 Markdown。
  - 该文件仍是内部讨论待办，而不是用户侧现状页。
  - 模块成熟度、QA 绿灯边界和当前主线仍主要散落在 `docs/superpowers` 和 `.memory`。
- 为什么是问题：
  - 你离线回看项目状态时，仍然要钻 `specs / plans / qa-report / .memory` 才能知道“现在哪些是真的”。
  - `docs/userDocs` 还没有承担对你最有价值的“稳定真相层”角色。
- 建议修正方向：
  - 先冻结最小信息架构，再开始写正文：
    - 项目现状
    - 模块状态矩阵
    - QA 分层说明
    - 滚动 todolist

## 2. 基于现状的改进方向、结果、好处和风险

| 方向 | 预期结果 | 好处 | 风险 |
| --- | --- | --- | --- |
| 固定文档类型职责矩阵，并给 `plans` 增加生命周期 | 文档入口恢复检索性，执行流水不再污染活动计划 | 降低检索成本，避免同主题继续平铺 | 需要一次性整理历史 plan，短期成本高 |
| 把模块状态改成 `design / implementation / verification / evidence` 四列 | 模块成熟度表达回到可举证状态 | 排期、讨论、对外口径更诚实 | 会暴露一些此前被写成 `completed` 的模块其实仍未落地 |
| 明确前端下一步唯一真相层：把正式控制台设计转成活动 plan 或显式废弃 | 前端不再同时受两个阶段文档牵引 | 后续改动目标清晰，测试不会再保护过渡态 | 需要先做一次决策，不能继续模糊推进 |
| 固定 QA 四层说明，并为 `passWithNoTests` 建台账 | QA 绿灯含义更准确 | 后续讨论不再混淆“工程通过”和“产品完成” | 报告模板和执行纪律会更重一些 |
| 为 `docs/userDocs` 建最小信息架构 | 你能直接看到项目现状与模块矩阵 | 离线回看更高效，减少重复讨论 | 如果不同步维护，会再次失真 |
| 在真相层治理后再做 bundle 优化和热点文件拆分 | 次优先级问题不会抢主线 | 节奏更稳，避免过早技术清洁 | 短期内 warning 和热点文件仍会存在 |

## 3. 我的建议

1. 先暂停本专题继续新增顶层 `spec/plan`，优先修正文档生命周期和模块状态表达。
2. 前端下一步不要再泛泛说“做一轮语义收口”，而是明确拍板：
   - 继续执行 `2026-04-13-console-shell-auth-settings-design.md`
   - 或显式冻结/废弃它
3. 如果该设计仍有效，我建议把它直接转成唯一活动 plan，并把以下内容当成同一批次收口：
   - `route-config`
   - 顶部壳层标题与导航
   - 页面文案
   - 附属路由去留
   - 对应测试
4. `docs/userDocs` 的第一页建议写“项目现状”，第二页写“模块状态矩阵”，第三页写“QA 分层说明”；`todolist` 继续只承担滚动决策和待拍板事项。
5. 当前不建议把 bundle 优化、热点文件拆分、更多 UI 微调放到第一优先级；它们应该排在真相层治理之后。

## Uncovered Areas / Risks

- 本轮未做真实浏览器下的登录、退出、改密、个人资料、团队设置主路径回归。
- 本轮未做移动端人工体验确认，因此前端 UI 质量仍然是受限结论。
- 本轮未做 `publish-gateway` 与 `plugin-runner` 的端到端联调，因此这两个模块只可下“骨架存在/局部验证存在”的结论，不能下“模块完成”结论。
- 由于本轮用户限定只更新 `docs/userDocs/todolist` 和 `docs/qa-report`，本次没有回写 `.memory/tool-memory`；但已记录两类环境限制事实：
  - `style-boundary` 在沙箱里会因 Vite 端口监听报 `EPERM`
  - `verify-backend` 在沙箱里会因本地权限依赖报 `Operation not permitted`
