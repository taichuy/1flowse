# 文档计划审计优化报告

更新时间：`2026-04-16 06:03 CST`

说明：本轮继续沿用同主题滚动更新，只补本轮新增或已升级的问题，不重复前两轮已经明确但没有本质变化的旧问题。旧问题仍默认有效。

审计输入：

- `git` 时间窗口：`2026-04-15 06:03 CST` 到 `2026-04-16 06:03 CST`
- 最近 `24` 小时提交数：`44`
- 最近 `24` 小时主线推进：
  - `web/app/src/features/agent-flow/*`
  - `web/app/src/features/applications/*`
  - `api/apps/api-server/src/routes/application_orchestration.rs`
  - `api/crates/control-plane/src/flow.rs`
  - `api/crates/storage-pg/src/flow_repository.rs`
  - `docs/qa-report/document-plan-audit.md`
- 本轮已运行验证：
  - `pnpm --dir web lint`：通过，但 `web/app/src/features/agent-flow/components/nodes/node-registry.tsx` 仍有 `4` 条 `react-refresh/only-export-components` warning
  - `pnpm --dir web test`：通过，`30` 个测试文件、`89` 个测试
  - `pnpm --dir web/app build`：通过，但主包 `dist/assets/index-D2ky4G0N.js` 仍为 `5,191.42 kB`，gzip 后 `1,554.34 kB`
  - `node scripts/node/verify-backend.js`：失败，直接停在 `rustfmt --check`
  - `cargo test -p control-plane flow_service_tests -v`：通过，`2` 个测试
  - `cargo test -p api-server application_orchestration_routes -v`：通过，`1` 个测试
  - `cargo test -p storage-pg flow_repository_tests -v`：通过，`3` 个测试
- 本轮受限项：
  - `node scripts/node/check-style-boundary.js page page.application-detail` 失败，原因是本地 `vite` dev server 在当前环境下监听 `0.0.0.0:3100` 时触发 `EPERM`
  - 当前工作树仍有未提交改动：`web/app/src/features/agent-flow/components/editor/agent-flow-editor.css`

## 1. 现状

### 1.1 现在开发情况和状态

- 当前真实状态已经很清楚：
  - `03` Application 宿主壳层已进入可运行状态
  - `04` agentFlow editor 第一版已进入可运行状态
  - `05/06B` 仍停留在设计基线，没有形成最小产品闭环
- 最近 `24` 小时的推进节奏依然很快。`44` 次提交说明项目不是“卡住”，而是“高频迭代中”。
- 但当前项目的主要矛盾已经不是“有没有在开发”，而是“顶层真值、验证真值、产品阶段表述”是否还和代码对齐。

### 1.2 对当前开发健康来说是好还是差

- 如果只看交付速度：`好`
  - `03/04` 主路径持续推进，前端与定向后端测试都为绿。
- 如果看工程治理和产品管理信号：`中偏弱`
  - 统一后端门禁仍是红灯。
  - 文档真值层已经从模块 README 漂移到更上游的产品主文档。
  - 性能与装载边界仍明显落后于功能速度。
- 更准确的判断是：
  - `实现健康`
  - `治理亚健康`
  - `阶段表达失真`

### 1.3 本轮新增或升级的问题

#### 问题一：顶层真值层已经裂到产品主文档，不再只是模块状态板落后

- 证据：
  - `docs/superpowers/specs/1flowse/2026-04-10-product-design.md` 仍明确写着：
    - `标准 Agent 兼容发布` 是产品主目标
    - `发布优先` 是核心原则
  - 但 `docs/superpowers/specs/1flowse/2026-04-10-product-requirements.md` 仍把以下内容写在 P1 核心需求里：
    - `FR-004 应用概览`
    - `FR-005 应用路由管理`
    - `FR-006 页面创建与数据源绑定`
    - `FR-007 页面结构协议`
    - `FR-008 动态页面渲染`
  - 同时 `docs/superpowers/specs/1flowse/modules/README.md` 仍把：
    - `03` 标成 `已确认待开发`
    - `04` 标成 `未来设计`
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md` 仍写着：
    - `状态：已确认，待写 implementation plan`
    - “当前首页仍是工作台正式空态，不是应用列表页”
    - “当前前后端还没有 Application 列表、创建、详情和应用内四分区路由”
- 这意味着什么：
  - 当前不是一份 README 没回填，而是：
    - 产品定位文档
    - 产品需求文档
    - 模块总览
    - 模块子文档
    这四层真值已经不同步。
- 为什么是问题：
  - 在 AI 日更节奏下，顶层文档一旦失真，后续任何“本周该做什么”“P1 还差什么”“方向有没有跑偏”的讨论都会建立在错误前提上。
  - 这已经开始影响产品定位判断，而不只是开发计划管理。

#### 问题二：计划闭环和验证闭环已经脱钩，提交不等于真正收尾

- 证据：
  - `docs/superpowers/plans/2026-04-15-agentflow-editor.md` 中：
    - `Step 3: Update style-boundary scenes and run the final verification suite` 仍未勾选
    - 但后面的 `Step 4: Commit` 已经勾选
  - `node scripts/node/verify-backend.js` 本轮依然直接失败在 `rustfmt --check`
  - `node scripts/node/check-style-boundary.js page page.application-detail` 本轮未拿到成功证据，失败原因是 `vite` 监听 `0.0.0.0:3100` 遇到 `EPERM`
- 这意味着什么：
  - 当前流程已经出现“代码先提交，最后验证以后再补”的倾向。
  - 统一验证入口和计划文档都不能稳定代表“这轮已经收尾”。
- 为什么是问题：
  - AI 时代速度很快，最怕的不是偶发红灯，而是“收尾定义失真”。
  - 一旦提交、计划勾选、最终验证三者不再一致，后续每轮审计都会先花时间辨认真实状态。

#### 问题三：P1 范围表达仍然过宽，当前主线像在做 authoring baseline，但主文档仍像在做全能 builder

- 证据：
  - `2026-04-10-product-design.md` 的产品定位是：
    - 以标准 Agent API 发布为中心
    - `Publish Endpoint` 是核心交付物
  - 但 `2026-04-10-product-requirements.md` 仍把应用路由、页面结构协议、动态页面渲染等 builder 向能力放进 P1 核心功能。
  - 当前过去 `24` 小时的真实实现则集中在：
    - Application 宿主
    - agentFlow editor
    - draft/history/save/restore
  - 对外发布、运行时调用链路、应用级 API Key 仍没有最小实现闭环。
- 这意味着什么：
  - 当前真实阶段更像：
    - `Application-hosted authoring baseline`
  - 而不是：
    - `P1 完整闭环已经进入均衡实现`
- 为什么是问题：
  - 如果不明确收紧阶段表达，团队会同时背三套目标：
    - publish-first
    - builder-first
    - editor-first
  - 三套目标都“看起来对”，但资源会被同时拉扯，最后谁都证明不完整。

#### 问题四：装载边界仍然没有切开，editor 成本继续外溢到整个控制台

- 证据：
  - `web/app/src/app/router.tsx` 仍同步导入：
    - `ApplicationDetailPage`
    - `HomePage`
    - `SettingsPage`
    - `EmbeddedAppsPage`
    - `ToolsPage`
    - `MePage`
    - `SignInPage`
  - `web/app/src/features/applications/pages/ApplicationDetailPage.tsx` 仍同步导入 `AgentFlowEditorPage`
  - 本轮生产构建主包仍为 `5,191.42 kB`，gzip 后 `1,554.34 kB`
- 这意味着什么：
  - 当前不是“有点大”，而是“editor 已经默认成为整个 console 的装载成本”。
  - 即使用户只进工作台、设置或个人资料，也仍被同步路由结构拖进同一主包体系。
- 为什么是问题：
  - 这是结构性问题，不是 warning 文案问题。
  - 再继续加 `04` 或进入 `05/06B`，会把后续所有功能都压在已经过重的主入口上。

#### 问题五：局部代码边界清理开始落后于速度，说明功能推进快于卫生治理

- 证据：
  - `pnpm --dir web lint` 通过，但 `web/app/src/features/agent-flow/components/nodes/node-registry.tsx` 仍有 `4` 条 `react-refresh/only-export-components` warning
  - 仓库里已经存在针对这一类问题的已验证工具记忆：应把 helper / 常量抽离出组件文件
- 这意味着什么：
  - 当前不是不知道怎么修，而是这类清理没有被纳入当轮收尾标准。
- 为什么是问题：
  - 单次 warning 不严重，但它说明“能跑就先过”的阈值正在慢慢升高。
  - 这类小边界如果持续累积，会让后续 editor feature 越来越难拆。

### 1.4 从短期来看风险和收益

- 短期收益：
  - `Application -> orchestration -> agentFlow` 主路径已经具备稳定演示价值。
  - 前端自动化和后端定向测试都说明当前主线不是“纯前端假页面”。
- 短期风险：
  - 顶层文档继续失真，会直接误导你对“P1 还差什么”的判断。
  - 统一验证入口仍然不可信，会让每轮收尾越来越依赖人工解释。
  - 主包仍未收口，继续加 editor 只会放大后续拆包成本。

### 1.5 从长期来看软件健康和质量

- 长期正向点：
  - 前后端主分层仍然在。
  - `route / service / repository / mapper` 没有明显塌掉。
  - `03/04` 已经从纸面设计转成可运行实现。
- 长期风险点：
  - 如果顶层真值层不回收，文档会从“协作导航”退化为“历史碎片”。
  - 如果统一门禁继续不可信，团队会逐步接受“局部测绿即可”。
  - 如果装载边界继续放任，后续任何新模块都会默认变成首包债务。

### 1.6 开发进度是如何

- 不建议再用旧人力时代“这个模块做完了吗”来评估进度。
- 在当前 AI 日更模式下，更应该看四个指标：
  - 主路径今天有没有更完整
  - 统一门禁今天有没有更可信
  - 文档真值今天有没有更同步
  - 下一阶段的系统性成本今天有没有下降
- 按这个口径看，本轮判断是：
  - 主路径实现：`快`
  - 统一门禁：`偏弱`
  - 真值同步：`弱`
  - 系统性成本控制：`明显慢于功能速度`

### 1.7 产品方向定位是否清晰，是否正确，是否需要调整

- 高层方向本身没有错：
  - `publish-first`
  - `Application` 作为宿主
  - `agentFlow` 作为第一条 authoring 主线
- 但当前阶段表达明显需要调整：
  - 现在还不能把项目描述成“P1 全闭环均衡推进”
  - 更准确的说法应该是：
    - `Application-hosted authoring baseline 已成立`
    - `下一阶段优先恢复统一真值与门禁，再补 05/06B 最小产品证明`
- 还需要再补一刀：
  - `2026-04-10-product-requirements.md` 中偏 builder 的早期范围，需要重新分类：
    - 是保留为更后续阶段
    - 还是继续留在 P1
  - 这件事如果不做，方向会一直“表面清晰，执行时模糊”。

## 2. 可能方向

### 方向 A：先回收顶层真值层

- 同步重写：
  - `2026-04-10-product-requirements.md`
  - `modules/README.md`
  - `03-workspace-and-application/README.md`
  - `2026-04-15-agentflow-editor.md`

### 方向 B：先恢复统一验证和收尾定义

- 让 `verify-backend` 回到可绿状态
- 明确 style-boundary 在当前环境下的正式执行路径
- 让“提交完成”和“验证完成”重新等价

### 方向 C：先治理前端装载边界

- 做路由级 lazy load
- 切开 `ApplicationDetailPage` 和 `AgentFlowEditorPage` 的同步装载关系

### 方向 D：先补最小 `05/06B` 产品证明

- 应用级 API Key
- 最小 Run List
- `publish-gateway` 的真实边界接口

### 方向 E：继续只追 editor 新功能

- 继续扩节点、交互、容器画布和面板能力

## 3. 不同方向的风险和收益

### 方向 A：先回收顶层真值层

- 收益：
  - 你后面对项目状态、P1 范围和阶段目标的讨论会重新建立在一个真值层上
  - AI 协作成本会明显下降
- 风险：
  - 短期看起来“不像在加功能”

### 方向 B：先恢复统一验证和收尾定义

- 收益：
  - 每轮开发都能重新回到“一个计划 + 一套门禁 + 一个收尾定义”
  - 可显著减少误判
- 风险：
  - 会花时间处理格式、脚本和执行路径，不直接增加用户可见能力

### 方向 C：先治理前端装载边界

- 收益：
  - 现在拆包，成本远低于 `05/06B` 后再回头治理
  - 可以把 editor 的重量重新收回到编排页自身
- 风险：
  - 会碰路由、查询边界和 shared shell 的真实拆分，不是无痛小修

### 方向 D：先补最小 `05/06B` 产品证明

- 收益：
  - 能最快验证“publish-first”没有只是停留在产品口号
  - 能把项目重新从 editor-only 的风险里拉回来
- 风险：
  - 如果 A/B/C 不先做，旧问题会被原样带进新模块

### 方向 E：继续只追 editor 新功能

- 收益：
  - 最容易延续当前实现动量
  - 演示能力会继续快速增加
- 风险：
  - 顶层真值会继续恶化
  - 装载成本会继续膨胀
  - 项目会越来越像“很强的 editor”，但不是“完成闭环的工作流平台”

## 4. 对此你建议是什么？

我的建议顺序是：`先 A+B，同步完成；再 C；再 D；最后才回到 E`。

### 建议一：先用一轮短治理，把顶层真值层和统一门禁同时收口

- 同一轮里完成三件事：
  - 修 `node scripts/node/verify-backend.js`
  - 回填 `2026-04-15-agentflow-editor.md`
  - 重写 `modules/README.md` 与 `03 README` 的当前状态描述
- 这样做的目的不是“补文档”，而是恢复单一真相层。

### 建议二：正式把 P1 表述收紧为“两段式”

- 第一段：
  - `Application-hosted authoring baseline 已落地`
- 第二段：
  - `接下来补 publish/runtime 的最小闭环证明`
- 同时把 `2026-04-10-product-requirements.md` 里偏 builder 的项明确处理：
  - 移出 P1
  - 或改成未来阶段
  - 不要再与当前主线混写

### 建议三：不要再拖懒加载

- 第一优先级不是继续调 chunk warning limit，而是：
  - `web/app/src/app/router.tsx` 路由级 lazy load
  - `ApplicationDetailPage` 与 `AgentFlowEditorPage` 解耦
- 目标很简单：
  - 让不进编排页的用户，不再默认为 editor 付成本

### 建议四：等真值层和装载边界收口后，再补最小 `05/06B` 产品证明

- 推荐顺序：
  - 应用级 API Key
  - 最小 Application Run List
  - `publish-gateway` 真实边界接口
- 这是把“publish-first”从定位重新拉回证据的最短路径。

### 建议五：AI 时代的进度管理不要再按“模块做完没”评估

- 建议改成固定四列：
  - `主路径闭环`
  - `统一门禁`
  - `真值同步`
  - `P1 证明`
- 这样更贴合当前 `44 commits / 24h` 的节奏，也比“03 完成百分之多少”更接近真实状态。

## 受限结论

- 前端运行态样式边界本轮未拿到新的成功证据，因为 style-boundary 依赖的 dev server 在当前环境监听端口时触发 `EPERM`
- 因此与真实页面视觉质量强相关的结论，本轮只下受限结论，不判定为完全通过
