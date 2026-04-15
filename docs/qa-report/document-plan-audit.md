# 文档计划审计优化报告

日期：`2026-04-16 03`

说明：本文件继续沿用同主题滚动更新。本轮不重复“03/04 已经启动”这一层事实，重点补充三类新证据：

- 真实门禁结果与受限结论
- 文档状态语义冲突
- 权限、导航与产品证明路径的错位

## 审计输入

- 近 24 小时 git：
  - 时间窗口：`2026-04-15 02` 到 `2026-04-16 02`
  - `41` 次提交
  - 主线集中在 `03 Application` 与 `04 agentFlow`，最近提交持续落在应用列表、应用详情、编排持久化、历史恢复、手动保存、连线重连和画布交互
- 近期记忆：
  - `.memory/project-memory/2026-04-15-module-02-access-control-status-evaluated.md`
  - `.memory/project-memory/2026-04-15-module-03-application-shell-plan-stage.md`
  - `.memory/project-memory/2026-04-15-module-03-application-shell-needs-future-hooks.md`
  - `.memory/project-memory/2026-04-15-module-04-editor-first-pass-direction.md`
  - `.memory/project-memory/2026-04-13-frontend-qa-current-state.md`
- 相关文档：
  - `docs/superpowers/specs/1flowse/2026-04-10-product-requirements.md`
  - `docs/superpowers/specs/1flowse/2026-04-10-product-design.md`
  - `docs/superpowers/specs/1flowse/2026-04-10-p1-architecture.md`
  - `docs/superpowers/specs/1flowse/modules/README.md`
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
  - `docs/superpowers/specs/1flowse/modules/04-chatflow-studio/README.md`
  - `docs/superpowers/specs/1flowse/modules/05-runtime-orchestration/README.md`
  - `docs/superpowers/specs/1flowse/modules/06b-publish-gateway/README.md`
  - `docs/superpowers/plans/2026-04-15-module-03-application-shell.md`
  - `docs/superpowers/plans/2026-04-15-agentflow-editor.md`
- 当前代码抽样：
  - `web/app/src/routes/route-config.ts`
  - `web/app/src/routes/route-guards.tsx`
  - `web/app/src/app/router.tsx`
  - `web/app/src/features/home/pages/HomePage.tsx`
  - `web/app/src/features/applications/pages/ApplicationListPage.tsx`
  - `web/app/src/features/applications/pages/ApplicationDetailPage.tsx`
  - `web/app/src/features/applications/components/ApplicationSectionState.tsx`
  - `web/app/src/features/agent-flow/pages/AgentFlowEditorPage.tsx`
  - `web/app/src/features/tools/pages/ToolsPage.tsx`
  - `web/app/src/features/embedded-apps/pages/EmbeddedAppsPage.tsx`
  - `api/apps/api-server/src/routes/applications.rs`
  - `api/apps/api-server/src/routes/application_orchestration.rs`
  - `api/crates/control-plane/src/application.rs`
  - `api/crates/control-plane/src/flow.rs`
  - `api/crates/storage-pg/src/mappers/flow_mapper.rs`
  - `api/apps/plugin-runner/src/lib.rs`
  - `api/crates/publish-gateway/src/lib.rs`

## 本轮验证结果

- 前端 lint：
  - `pnpm --dir web/app exec eslint src --ext .ts,.tsx`
  - 结果：通过，但有 `4` 条 warning
  - 位置：`web/app/src/features/agent-flow/components/nodes/node-registry.tsx`
  - 含义：组件与常量/函数仍混在同文件，Fast Refresh 边界不干净
- 前端定向测试：
  - `pnpm --dir web/app exec vitest run src/routes/_tests/application-shell-routing.test.tsx src/features/agent-flow/_tests/agent-flow-editor-page.test.tsx src/style-boundary/_tests/registry.test.tsx`
  - 结果：`3` 个文件、`18` 个用例通过
  - 备注：测试过程中持续出现 React Flow 容器尺寸与样式加载 warning，说明测试通过不等于真实画布环境完全贴合
- 前端构建：
  - `pnpm --dir web/app build`
  - 结果：通过
  - 构建告警：chunk 过大
  - 当前体积：
    - `dist/assets/index-D2ky4G0N.js`：`5191.42 kB`
    - gzip 后：`1554.34 kB`
    - `dist/assets/index-DbOSWkRI.css`：`337.71 kB`
- 统一后端验证：
  - `node scripts/node/verify-backend.js`
  - 结果：失败
  - 原因：`cargo fmt --check` 直接报差异，统一后端门禁当前为红
- 后端定向路由测试：
  - `cargo test -p api-server application_orchestration_routes -- --nocapture`
  - 结果：通过，`1` 个路由集成测试通过
- 后端 service 测试：
  - `cargo test -p control-plane application_service_tests -- --nocapture`
  - 结果：通过，`3` 个用例通过
  - `cargo test -p control-plane flow_service_tests -- --nocapture`
  - 结果：通过，`2` 个用例通过
- 运行时样式回归：
  - `node scripts/node/check-style-boundary.js page page.application-detail`
  - 结果：失败
  - 原因：`dev-up` 拉起前端超时；`tmp/logs/web.log` 中可见多次 `vite` 在 `0.0.0.0:3100` 上 `listen EPERM`
- 受限结论：
  - 因 `style-boundary` 真实运行场景未闭合，本轮前端 UI 质量只能下“受限通过”结论，不能下“真实运行已完全验证通过”结论

## 1. 现状

### 1.1 现在开发情况和状态

- 当前开发状态已经不是“文档主线”，而是“代码主线”。
  - `HomePage` 已直接切到 `ApplicationListPage`
  - 应用详情四分区路由已经挂在 `/applications/:id/orchestration|api|logs|monitoring`
  - `orchestration` 分区不再是静态说明，而是直接进入 `AgentFlowEditorPage`
  - `agentFlow` 已具备 Draft、历史版本、手动保存、恢复、视口保持、连线重连
- 计划文件也反映出这一点：
  - `docs/superpowers/plans/2026-04-15-module-03-application-shell.md` 真实勾选数为 `30`，显式未勾选项为 `0`
  - `docs/superpowers/plans/2026-04-15-agentflow-editor.md` 真实勾选数为 `33`，显式未勾选项为 `1`
  - `04` 唯一明确未闭合项就是 `style-boundary` 场景与最终验证
- 但主产品闭环仍没有到“发布优先平台”的完成口径。
  - `api / logs / monitoring` 仍主要是 contract state
  - `publish-gateway` 仍只有 `crate_name()`
  - `plugin-runner` 仍只有健康检查、绑定地址和 tracing 初始化

### 1.2 对当前开发健康来说是好还是差

- 如果只看开发速度：`好`
  - `41` 次提交不是碎修，而是持续把 `03/04` 主线推成可运行状态
- 如果看工程边界：`中上`
  - 前后端定向测试都通过
  - `route / service / repository / mapper` 分层仍成立
  - `Application` 作为一级宿主容器的抽象是稳定的
- 如果看统一门禁与真实运行验证：`中偏弱`
  - 后端统一验证脚本是红的
  - 样式边界真实运行验证是红的
  - 前端测试里持续出现画布 warning，说明测试环境和真实页面环境还有缝
- 当前最准确的判断不是“健康差”，而是：
  - `主线推进快`
  - `统一真值层和最后一公里验证跟不上`

### 1.3 当前最主要的问题

#### 问题一：文档不只是滞后，而是“状态语义”已经冲突

- `docs/superpowers/specs/1flowse/modules/README.md` 仍把：
  - `03` 写成 `已确认待开发`
  - `04` 写成 `未来设计`
- 但当前代码与计划事实是：
  - `03` 计划已经执行完成
  - `04` 编辑器第一版已形成真实页面和后端持久化闭环
- 同时 `03-workspace-and-application/README.md` 还写着：
  - `状态：已确认，待写 implementation plan`
  - `当前前后端还没有 Application 列表、创建、详情和四分区路由`
- 这说明当前问题已经不是“少更新几行文档”，而是：
  - 根模块总览、模块 README、计划文档、代码真相四层语义没有统一
- 在 AI 日更节奏里，这会直接放大错误上下文，后续每一轮审计和实现都要先做一次事实校正

#### 问题二：产品定位仍写“发布优先”，但当前可证明能力是“authoring 优先”

- 产品设计与需求文档明确写的是：
  - `以标准 Agent API 发布为中心`
  - `发布优先`
- 但当前代码真实可体验的核心是：
  - 工作台应用列表
  - 应用详情壳层
  - `agentFlow` 编辑器
- 当前尚未形成真实产品证明的能力是：
  - 应用级 API Key 管理
  - 对外调用入口
  - Application Run 列表 / 详情
  - 指标与 tracing
- 这不是方向错，而是“阶段口径”还没改。
- 如果继续沿旧口径对外描述，会把尚未兑现的发布、运行、监控误当成当前能力

#### 问题三：权限真值层仍然裂成两套

- 前端路由层：
  - `home`
  - `application-detail`
  - `tools`
  - 都还挂在 `route_page.view.all`
- 后端应用资源层：
  - `ApplicationService` 真正使用的是 `application.view.all / own`
- 当前实际效果是：
  - 用户可能先通过前端 `RouteGuard`
  - 进入页面壳层后再被接口打回 `403`
- 这会带来三个长期问题：
  - 角色与页面可见性更难解释
  - 空态和拒绝态要维护两套
  - 后续 `api / logs / monitoring` 一旦开始真实消费资源权限，前端 guard 复杂度会继续上升

#### 问题四：工程门禁不是全绿，而且红灯已经开始落在“交付质量”上

- 后端红灯：
  - `verify-backend.js` 当前在 `cargo fmt --check` 阶段即失败
  - 这不代表功能坏了，但代表统一后端验证不可用
- 前端红灯：
  - 构建虽通过，但主包已经到 `5.19 MB`
  - CSS 主包已到 `337.71 kB`
  - 构建器明确给出 chunk 过大告警
- QA 红灯：
  - `style-boundary` 真实运行未闭合
  - 这意味着共享壳层和真实页面样式仍缺正式运行证据

#### 问题五：测试结论正在和真实画布环境拉开距离

- 直接跑定向 vitest 时，`agentFlow` 相关用例持续打印：
  - React Flow 父容器宽高 warning
  - React Flow 样式未加载 warning
- 这些 warning 没让测试失败，但说明：
  - 当前测试更偏交互逻辑回归
  - 对真实画布渲染环境的贴合度还不够高
- 所以现在不能把“18 个关键用例通过”直接等价成“真实画布体验稳定”

#### 问题六：`agent-flow` 已经到结构压力点

- 目录压力：
  - `web/app/src/features/agent-flow` 共 `31` 个文件
  - `components` 子目录已有 `15` 个文件，已到项目约定上限
- 文件压力：
  - `node-definitions.tsx`：`485` 行
  - `AgentFlowCanvas.tsx`：`404` 行
  - `NodeInspector.tsx`：`392` 行
  - `agent-flow-editor.css`：`354` 行
- lint 旁证：
  - `node-registry.tsx` 仍有 `4` 条 Fast Refresh warning
- 这说明继续横向加节点、画布交互和面板逻辑时，改动成本会明显上升

#### 问题七：L0 暴露面仍然大于当前真实主线

- 当前真正成熟的主路径是：
  - `工作台 -> Application -> orchestration`
- 但一级导航仍同时暴露：
  - `子系统`
  - `工具`
- 其中：
  - `ToolsPage` 仍是正式“建设中”页面
  - `EmbeddedAppsPage` 仍是边界说明页，不是高频主业务页
- 这会稀释当前产品中心，让用户以为项目已经进入更广的多入口平台阶段

### 1.4 从短期来看风险和收益

- 短期收益：
  - `03/04` 已经形成真实可演示路径
  - 用户可以真实创建应用、进入应用、编辑 `agentFlow`
  - 后端定向路由和 service 测试都说明这条主线不是空壳
- 短期风险：
  - 如果继续只扩 editor，会进一步放大“authoring 强、publish/run 弱”的失衡
  - 如果继续沿用过期文档判断阶段，后续 AI 协作成本会快速上升
  - 如果统一门禁不收口，后面每次都要先解释“为什么局部绿、全局红”

### 1.5 从长期来看软件健康和质量

- 长期正向点：
  - 后端核心分层仍健康
  - `Application` 作为一级交付容器方向是对的
  - 前端已经具备可持续迭代的测试和构建基线
- 长期风险点：
  - 文档状态语义如果不统一，仓库会失去稳定真值层
  - `agentFlow` 若不先做拆分与收纳，后续每加一个节点都会提高维护成本
  - 如果包体不控，编辑器越强，首屏越重
  - 如果权限真值继续双层维护，后续 `05/06B` 接入时角色设计会越来越绕

### 1.6 开发进度如何评估

- 不适合继续用旧人力时代“今天做了几个页面”的口径评估。
- 在 AI 时代，更应该看两件事：
  - 今天是否完成了一段真实闭环
  - 今天是否让明天继续推进时减少歧义
- 按这个口径看：
  - 主线推进：`快`
  - 功能可演示性：`快`
  - 真值同步：`慢`
  - 统一门禁：`慢`
  - `05/06B` 产品证明：`明显慢于 03/04`

### 1.7 产品方向定位是否清晰、是否正确、是否需要调整

- 核心方向仍然是对的：
  - `Application` 作为交付容器
  - `agentFlow` 作为首个最核心的可编辑资产
  - 后续把运行、日志、监控、发布挂到应用壳层下
- 需要调整的是阶段口径，不是总方向：
  - 当前更准确的阶段定位是：
    - `Application-hosted agentFlow authoring baseline`
  - 还不能直接说自己已经进入完整的 `publish-first platform baseline`
- 如果现在不改阶段口径，就会持续用未来能力给当前阶段背书

## 2. 可能方向

### 方向 A：继续深挖 `04 agentFlow`

- 继续补更多节点
- 继续补更复杂的画布交互
- 继续强化 overlay、调试面板和 inspector 细节

### 方向 B：把下一轮主线切到最小 `publish / run / logs` 证明

- 先把 `api` 分区做成真实应用级契约入口
- 先把 `logs` 分区做成最小可查运行对象入口
- 让 `monitoring` 至少具备真实指标锚点

### 方向 C：先用一个短周期做“真值与质量收口”

- 统一模块文档状态语义
- 清掉后端 `fmt --check` 红灯
- 解决 `style-boundary` 真实运行验证路径
- 对 `agentFlow` 做目录和包体收纳
- 对齐路由权限与资源权限真值

## 3. 不同方向的风险和收益

### 方向 A 的风险和收益

- 收益：
  - 最快继续提升可见功能面
  - demo 体验会继续增强
- 风险：
  - 会进一步拉大“编辑器能力”和“发布/运行能力”的差距
  - 包体和结构压力会继续扩大
  - 产品会更像“流程编排编辑器”，而不是“发布优先平台”

### 方向 B 的风险和收益

- 收益：
  - 能最快把产品主叙事和真实体验重新对齐
  - 能让 `api / logs / monitoring` 从 contract state 变成真实入口
  - 能真正验证 `publish-first` 这条定位是否站得住
- 风险：
  - 对后端运行时、发布网关与权限边界要求更高
  - 短期里 editor 表面上新增的功能点会变少

### 方向 C 的风险和收益

- 收益：
  - 能恢复“文档真相”“代码真相”“门禁真相”的一致性
  - 能明显降低后续 AI 与人继续推进时的上下文误判成本
  - 能在继续扩功能前先压住结构债和包体债
- 风险：
  - 如果只做收口不接新证明，用户会感知这一轮“新能力变少”
  - 如果执行不够硬，很容易退化成只改文档、不改真实门禁

## 4. 对此你建议是什么

- 建议采用 `方向 C -> 方向 B` 的组合，而不是继续单独加深 `方向 A`
- 建议顺序如下：
  - 第一步：用一个短周期收口真值和门禁
    - 修正 `docs/superpowers/specs/1flowse/modules/README.md`
    - 修正 `03-workspace-and-application/README.md`
    - 明确 `04-chatflow-studio/README.md` 的状态语义到底是“设计完成”还是“实现基线”
    - 清掉 `cargo fmt --check` 红灯，恢复 `verify-backend.js`
    - 把 `style-boundary` 的正式执行路径固定下来
    - 对齐 `route_page.view.all` 与 `application.view.*` 的关系
  - 第二步：在门禁恢复后，马上切到最小 `publish / run / logs` 证明
    - `api` 分区先做真实的应用级 API Key 与调用契约只读页
    - `logs` 分区先做最小 `Application Run List` 或查询契约
    - `monitoring` 先只做真实指标锚点，不急着上完整图表
  - 第三步：在继续扩 editor 前先做结构收纳
    - 拆 `node-registry`
    - 拆部分 `node-definitions`
    - 把 editor 重依赖开始做 lazy load / chunk split
- 一句话结论：
  - 当前项目不是慢，也不是方向错。
  - 当前真正的问题是：代码已经进入可运行主线，但文档真值、统一门禁和产品证明还没有同步跟上。

## 2026-04-16 03 增量审计

说明：本轮不重复“03/04 已经进入真实开发”这一层结论，重点补四个上轮未展开的问题：需求基线漂移、用户界面泄露内部术语、导航与权限真值错层、以及发布/运行/插件主线的长期失衡。

### 1. 现状

#### 1.1 本轮新增证据

- 新鲜验证结果：
  - `pnpm --dir web lint` 通过，但 `web/app/src/features/agent-flow/components/nodes/node-registry.tsx` 仍有 `4` 条 Fast Refresh warning
  - `pnpm --dir web/app exec vitest run ...application-shell-routing... ...agent-flow-editor-page... ...style-boundary registry...` 通过，`18` 个用例全部通过，但 React Flow 持续打印容器尺寸与样式加载 warning
  - `pnpm --dir web/app build` 通过，但主包仍是 `5,191.42 kB`，gzip 后 `1,554.34 kB`，CSS 主包 `337.71 kB`
  - `node scripts/node/verify-backend.js` 失败，直接卡在 `cargo fmt --check`
  - `node scripts/node/check-style-boundary.js page page.application-detail` 失败，`tmp/logs/web.log` 里可见 `vite` 多次报 `listen EPERM: operation not permitted 0.0.0.0:3100`
- 最近 `24` 小时 git 仍然说明节奏非常快，但新增价值继续集中在 `03/04`：
  - 应用壳层与 editor 主线在推进
  - 需求基线、产品口径和门禁恢复没有同步推进

#### 1.2 新暴露的问题

##### 问题一：需求文档和当前主线已经不是“滞后”，而是“目标集不同”

- `docs/superpowers/specs/1flowse/2026-04-10-product-requirements.md:24-27` 仍把 P1 闭环定义成：
  - 发布成标准 Agent API
  - 外部稳定调用
  - 日志、监控、权限管理
- 同一份需求文档 `:100-120` 还要求：
  - `应用概览`
  - 应用内路由管理
  - 页面结构协议
  - 动态页面渲染
- 但当前真实代码主线是：
  - `HomePage -> ApplicationListPage`
  - `/applications/:id` 直接重定向到 `orchestration`
  - `AgentFlowEditorPage` 成为唯一成熟主内容
- 这说明当前不是“实现慢于需求”这么简单，而是：
  - 需求文档仍像“AI 应用平台广口径”
  - 当前代码主线已经收缩成“Application-hosted agentFlow authoring baseline”

##### 问题二：用户界面开始直接暴露内部研发术语和阶段编号

- `web/AGENTS.md:30-34` 明确要求 UI 禁止出现内部提示词和调试文本。
- 但当前 `web/app/src/features/applications/components/ApplicationSectionState.tsx:22-23, 65-66, 110-111, 148` 直接把 `03`、`04`、`05`、`06B` 写进用户界面说明。
- 这些文本对研发是说明，对用户却是内部阶段编号泄露，会造成三个副作用：
  - 产品像在展示 roadmap，而不是可用能力
  - 文案一旦落后就直接变成错误引导
  - UI 质量门禁会被“设计讨论副本”侵蚀

##### 问题三：导航、权限和路由行为有三套真相

- 权限真值裂开：
  - 前端 `web/app/src/routes/route-config.ts:15-30` 仍用 `route_page.view.all` 保护 `home` 和 `application-detail`
  - 后端 `api/crates/control-plane/src/application.rs:95-132` 真正消费的是 `application.view.all / own`
- 导航语义裂开：
  - `getSelectedRouteId` 把 `application-detail` 强制映射回 `home`，意味着应用详情在导航上仍被当成“工作台子态”
  - 但实际产品心智里，它已经是核心二级工作区
- 路由行为也没完全进入 SPA 真值：
  - `web/app/src/features/applications/components/ApplicationCardGrid.tsx:45-47` 仍用 `<a href>`
  - `web/app/src/features/applications/pages/ApplicationListPage.tsx:85-87` 创建后仍用 `window.location.assign`
- 结果是：
  - 权限判断靠前端壳层一层、后端资源一层
  - 跳转有的走 router，有的直接整页刷新
  - 随着后续 `api/logs/monitoring` 变真实，行为不一致只会更明显

##### 问题四：对外差异化能力仍没跟上 authoring 速度

- 产品设计文档 `docs/superpowers/specs/1flowse/2026-04-10-product-design.md:8-32` 仍明确：
  - `发布优先`
  - `State Model` 是竞争力
  - `Plugin Framework` 是架构支撑层
- 但当前代码现实是：
  - `api/crates/publish-gateway/src/lib.rs:1-2` 仍只有 `crate_name()`
  - `api/apps/plugin-runner/src/lib.rs:17-42` 仍只有健康检查、绑定地址和 tracing 初始化
  - `api/crates/control-plane/src/application.rs:293-323` 中 `api/logs/monitoring` 全部仍是 `planned`
- 这会导致一个长期风险：
  - 编辑器越来越强
  - 但真正决定 1Flowse 与普通 workflow builder 区别的 publish/runtime/plugin 还没有形成可证明基线

##### 问题五：`agent-flow` 已经进入结构债前夜

- 目录与文件压力现在可以量化：
  - `web/app/src/features/agent-flow` 共 `31` 个文件
  - `components` 下共 `15` 个文件，已经触到目录约定上限
  - `node-definitions.tsx` `485` 行
  - `AgentFlowCanvas.tsx` `404` 行
  - `NodeInspector.tsx` `392` 行
  - `agent-flow-editor.css` `354` 行
- `node-registry.tsx:92-139` 的 lint warning 说明这个目录已经开始把“组件导出”和“映射/转换函数”混在一起。
- 这不是现在就坏，但如果下一轮继续加节点、加容器、加交互，维护成本会明显上升。

### 2. 可能方向

#### 方向 A：先收缩阶段口径，重写需求基线

- 承认当前阶段真实名称是 `Application-hosted agentFlow authoring baseline`
- 把暂未进入真实主线的 `概览 / 路由管理 / 页面协议 / 动态页面 / 发布调用` 从当前阶段文档里拆开
- 同步模块 README、需求文档和用户可见文案

#### 方向 B：下一轮直接补最小发布/运行证明

- `api` 分区先做真实应用级 API Key 与调用契约
- `logs` 分区先做最小 `Application Run`
- `monitoring` 先做真实指标锚点
- `publish-gateway` 与 `plugin-runner` 至少做出最小可证明对象，而不是继续纯骨架

#### 方向 C：继续加深 editor 功能

- 继续补节点
- 继续补画布交互
- 继续强化 overlay、inspector、history 与容器编排体验

### 3. 不同方向的风险和收益

#### 方向 A 的风险和收益

- 收益：
  - 会立刻恢复产品叙事和代码真相的一致性
  - 能明显降低后续 AI 审计、实现和讨论时的上下文噪声
  - 能把“需求没做完”和“当前阶段已主动收缩”区分清楚
- 风险：
  - 这轮看上去更像“收口”和“减法”，用户侧新功能感知不强

#### 方向 B 的风险和收益

- 收益：
  - 最能验证产品定位是不是还坚持 `publish-first`
  - 最能补齐当前主线最缺的对外证明
  - 能把 `API / 日志 / 监控 / 插件` 从文案变成真实对象
- 风险：
  - 需要更强的后端边界与契约治理
  - 短期内 editor 新增功能数量会下降

#### 方向 C 的风险和收益

- 收益：
  - demo 会继续变强，视觉体验和可操作面会继续提升
  - 短期内最容易让“能看到的东西”变多
- 风险：
  - 会继续扩大 `authoring > publish/runtime/plugin` 的失衡
  - 文档真值、权限真值和导航真值会继续被拖后
  - 包体和结构债会更快积累

### 4. 对此你建议是什么

- 建议顺序改成 `方向 A -> 方向 B`，而不是继续单独走 `方向 C`
- 具体建议：
  - 先统一阶段口径
    - 把需求文档里不再属于当前阶段的广口径能力拆开
    - 把 `03/04/05/06B` 这类研发术语从用户界面移除
    - 把 `03`、模块总览、`04` 的状态语义统一到当前代码事实
  - 再收导航与权限真值
    - 对齐 `route_page.view.all` 与 `application.view.*`
    - 把应用列表和创建后的跳转改为 router 真值，不再硬刷新
    - 重新判断 `工具`、`子系统` 是否还应该维持当前一级暴露度
  - 然后立刻补最小发布/运行证明
    - `publish-gateway` 至少不再是空 crate
    - `plugin-runner` 至少有一个正式能力槽位或注册/绑定对象
    - `api / logs / monitoring` 至少有一条真实数据链路
  - editor 继续扩之前，先做拆分与 lazy load
- 本轮一句话结论：
  - 现在的问题已经不只是“功能还没做完”，而是“当前产品说自己是什么”和“当前代码真正证明了什么”之间开始出现系统性偏差。
