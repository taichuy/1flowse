# 文档计划审计优化报告

日期：`2026-04-15 00`

说明：本文件恢复同主题滚动报告，覆盖本轮最新审计结论。重点不重复上一版已经失效的“plans 目录过大”等旧问题，只记录 `2026-04-15 00` 仍然成立的事实。

## 审计输入

- 近 24 小时 git：
  - `2026-04-14 00:31` 到 `2026-04-15 00:25`
  - `718` 次文件触达
  - `43136` 行新增
  - `24213` 行删除
- 近期记忆：
  - `.memory/project-memory/2026-04-13-backend-governance-phase-two-direction.md`
  - `.memory/project-memory/2026-04-13-frontend-qa-current-state.md`
  - `.memory/project-memory/2026-04-14-role-policy-flags-and-default-member-role-implemented.md`
  - `.memory/project-memory/2026-04-14-settings-api-docs-on-demand-direction.md`
  - `.memory/project-memory/2026-04-14-web-shell-layout-full-width-direction.md`
  - `.memory/project-memory/2026-04-14-modules-spec-status-reclassification-direction.md`
- 相关文档：
  - `docs/superpowers/plans/2026-04-14-console-shell-auth-settings.md`
  - `docs/superpowers/plans/2026-04-14-account-settings-shared-shell.md`
  - `docs/superpowers/plans/2026-04-14-settings-api-docs-on-demand.md`
  - `docs/superpowers/specs/1flowse/modules/README.md`
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
  - `docs/superpowers/specs/1flowse/modules/06a-internal-api-docs/README.md`
  - `docs/superpowers/specs/1flowse/modules/08-plugin-framework/README.md`
- 当前代码：
  - `web/app/src/routes/route-config.ts`
  - `web/app/src/features/home/pages/HomePage.tsx`
  - `web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx`
  - `web/app/src/features/tools/pages/ToolsPage.tsx`
  - `web/app/src/features/settings/components/ApiDocsPanel.tsx`
  - `api/apps/plugin-runner/src/lib.rs`
  - `api/crates/publish-gateway/src/lib.rs`
- 已运行验证：
  - `pnpm --dir web/app exec vitest run src/features/settings/_tests/api-docs-panel.test.tsx src/features/me/_tests/me-page.test.tsx src/routes/_tests/section-shell-routing.test.tsx src/style-boundary/_tests/registry.test.tsx src/app/_tests/app-shell.test.tsx`
    - 结果：`5` 个文件、`25` 个用例全部通过
  - `cargo test -p api-server openapi_docs_tests -- --nocapture`
    - 结果：`6` 个用例全部通过
  - `node scripts/node/check-style-boundary.js page page.settings`
    - 沙箱内首次失败：`vite` 监听 `3100` 端口报 `EPERM`
    - 提权复跑结果：`PASS page.settings`

## 1. 现状

### 1.1 开发情况和状态

- 当前开发速度不是慢，而是非常快。
  - 近 24 小时提交密度极高，实际产出已经接近“AI 时代的日更节奏”，不能再按传统人力的一周一功能去衡量。
  - 这一天真正落地的，是控制台壳层、设置区共享结构、权限策略位、受保护 API 文档链路和工作空间语义治理。
- 当前工程状态不是“混乱失控”，而是“基础设施推进快，主产品闭环推进慢”。
  - 前端关键回归是绿的：设置 API 文档、`/me`、section shell、style-boundary 当前都能过。
  - 后端 API 文档裁剪链路是绿的：`openapi_docs_tests` 当前全部通过。
  - 当前工作区仍有 `9` 个代码文件未提交改动，说明本轮还有收尾中的工作，不是完全静止态。

### 1.2 当前开发健康是好还是差

- 如果只看工程健康：偏好。
  - 前后端都有真实验证，不是只有文档和口头状态。
  - `route / shell / settings / docs / role policy` 已经形成可维护结构，而不是一次性脚手架。
- 如果看产品健康：偏差。
  - `web/app/src/routes/route-config.ts` 当前只有 `home / embedded-apps / tools / settings / me / sign-in`。
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md` 明确写的是“下一主线应先补 Application 作为 Flow 宿主容器”。
  - 但当前代码里没有应用列表、应用创建、应用详情、应用概览和进入 Flow 的真实路由闭环。
  - `HomePage` 现在仍是账号摘要和后端健康检查页，不是应用列表入口。
  - `ToolsPage` 直接写明“统一工具入口正在建设中”。

### 1.3 短期风险和收益

- 短期收益已经出现。
  - 控制台登录后主壳层、`/me`、`/settings`、权限化 API 文档、角色策略位都已具备继续扩展的基础。
  - 这些基础设施把后续管理能力和治理能力打稳了，后面再补更多后台功能会更快。
- 短期风险也很明确。
  - 当前新增价值更偏“管理台基础设施”和“治理正确性”，而不是用户真正进入产品主线后的首个业务闭环。
  - 如果继续把大部分产能投在设置区、文档页、权限治理，短期内会越来越像“后台控制台很完整，但主产品还没开跑”。

### 1.4 长期软件健康和质量

- 长期工程质量方向是对的。
  - `workspace/system` 语义、权限治理、OpenAPI 裁剪、样式边界门禁都在变硬。
  - `plugin-runner` 和 `publish-gateway` 目前都还只是骨架，这种写法反而比把它们包装成“已完成模块”更诚实。
- 长期产品风险在于优先级失衡。
  - `api/crates/publish-gateway/src/lib.rs` 目前仍只有 `crate_name()`。
  - `api/apps/plugin-runner/src/lib.rs` 目前仍只是健康检查和绑定地址解析。
  - `docs/superpowers/specs/1flowse/modules/08-plugin-framework/README.md` 也明确写的是“规则已确认，能力未完备”。
  - 这说明平台扩展边界有设计，但真正可消费的产品能力还很早；如果这时继续把大量产能投向治理细节，长期会形成“架构前置过深，用户价值后置过久”的结构性问题。

### 1.5 开发进度该怎么判断

- 不建议再用旧人力时代的“看起来一天没做主功能，所以进度慢”去评估。
  - 这 24 小时实际完成的工程量很大，且验证链条真实存在。
  - 在 AI 时代，更合理的评估口径不是“写了多少代码”，而是“今天有没有让用户更接近完整闭环”。
- 按这个口径看：
  - 工程进度：快
  - 治理进度：快
  - 主产品闭环进度：慢

### 1.6 产品方向和定位是否清晰

- 高层定位大体是清晰且正确的。
  - 当前代码和文档都指向同一个方向：`workspace` 作用域下的 AI 工作台，后续以 `Application -> Flow -> Runtime -> Plugin` 为主线。
  - 这个方向本身没有明显跑偏。
- 真正需要调整的不是大方向，而是阶段排序。
  - 模块文档已经把 `03 Flow 前置容器` 标成下一步，但实际近 24 小时主产能主要落在 `settings / docs / role / shell`。
  - 这不是方向错，而是执行焦点还没完全切到主产品入口。

## 2. 可能方向

### 方向 A：继续加码治理和后台能力

- 继续扩 `settings`、角色、权限、内部文档、插件约束、工作空间治理。
- 把后台控制台做到更稳、更完整，再进入主产品闭环。

### 方向 B：切主线到 `03 Flow 前置容器`

- 以模块 `03` 为唯一主线，先做：
  - 应用列表
  - 创建应用
  - 进入应用概览
  - 从概览页进入后续 Flow 主入口
- 后台治理只修阻塞问题，不再扩专题。

### 方向 C：双速推进，但硬性限制治理占比

- 继续保留少量治理收尾：
  - 当前 settings/docs/role 链路的缺陷修复
  - 现有回归门禁维护
- 同时把大部分产能切到 `03`，要求每天至少交付一个用户可见的主产品闭环增量。

## 3. 不同方向的风险和收益

### 方向 A 的风险和收益

- 收益：
  - 后台和治理层会越来越稳，后面再加功能摩擦更小。
  - 对权限、文档、样式边界、工作空间语义这些底座更放心。
- 风险：
  - 用户可感知的主产品进展会继续偏慢。
  - 容易把项目外观做成“控制台很成熟，产品核心还没开始”。
  - 会放大“架构正确但体验闭环迟迟不出现”的长期观感风险。

### 方向 B 的风险和收益

- 收益：
  - 最快把产品真正核心的 `Application -> Flow` 路径跑通。
  - 能尽快验证当前产品定位是否真的被市场或你自己认可。
  - 能让现在已经存在的控制台和权限体系开始承载真实业务对象。
- 风险：
  - 现有治理链路里残留的小问题可能被延后。
  - 如果完全停止治理，会增加后续回头补规则的成本。

### 方向 C 的风险和收益

- 收益：
  - 兼顾当前已经投入很多的治理资产，不会浪费。
  - 同时把主产品闭环推起来，避免继续失衡。
  - 更适合 AI 时代：底座不完全停，但必须每天有用户可见结果。
- 风险：
  - 对节奏控制要求高。
  - 如果没有硬性规则，很容易又滑回“80% 产能都去补后台”的老轨道。

## 4. 对此你建议是什么

- 建议选 `方向 C`，但执行上要非常硬。
- 具体建议如下：
  - 立即把 `03 Flow 前置容器` 设为当前唯一产品主线。
  - `settings / docs / role / shell` 不再开新专题，只允许做阻塞修复和回归维护。
  - 用 AI 时代节奏重新定义进度：
    - 每天至少交付一个用户可见闭环增量
    - 每天最多只允许一个治理专题并行存在
  - 接下来最值得落的不是再优化设置页，而是：
    - 应用列表
    - 创建应用
    - 进入应用概览
    - 概览页到 Flow 主入口
  - 文档口径也要同步：
    - 明确当前“工程健康不错，但产品闭环仍未启动”
    - 不要把后台能力扩展继续写成主产品进展

## 结论

- 现在开发情况不是差，而是“工程基础好、推进速度快、主产品闭环偏慢”。
- 对当前开发健康的判断应是：
  - 工程健康：`中上`
  - 产品推进健康：`中下`
- 产品定位本身不需要大改，真正该调的是阶段焦点。
- 下一阶段最重要的不是再补一轮后台治理，而是让 `03 Flow 前置容器` 从文档里的“下一步”变成代码里的“当前主线”。
