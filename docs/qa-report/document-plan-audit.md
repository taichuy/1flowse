# 文档计划审计优化报告

更新时间：`2026-04-16 05:09 CST`

说明：本轮继续沿用同主题滚动更新，但只补新的证据和判断，不重复上一轮已经明确的五个问题：`flow.edit.*` 未真正接到编排写入口、进入应用仍有整页刷新、发布入口假可用、一级导航暴露面偏大、产品阶段口径未切到 authoring baseline。

审计输入：

- `git` 时间窗口：`2026-04-15 05:09 CST` 到 `2026-04-16 05:09 CST`
- 最近 `24` 小时提交数：`43`
- 最近 `24` 小时推进重心：仍明显集中在 `03/04`
  - `web/app/src/features/agent-flow/*`
  - `web/app/src/features/applications/*`
  - `api/apps/api-server/src/routes/application_orchestration.rs`
  - `api/crates/control-plane/src/flow.rs`
  - `api/crates/storage-pg/src/flow_repository.rs`
- 本轮运行验证：
  - `pnpm --dir web lint`：通过，但 `web/app/src/features/agent-flow/components/nodes/node-registry.tsx` 有 `4` 条 `react-refresh/only-export-components` warning
  - `pnpm --dir web test`：通过，`30` 个测试文件、`89` 个测试
  - `pnpm --dir web/app build`：通过，但主包 `dist/assets/index-D2ky4G0N.js` 达到 `5,191.42 kB`，gzip 后 `1,554.34 kB`
  - `node scripts/node/verify-backend.js`：失败，先卡在 `rustfmt --check`
  - `cargo test -p control-plane flow_service_tests -v`：通过，`2` 个测试
  - `cargo test -p api-server application_orchestration_routes -v`：通过，`1` 个测试
  - `cargo test -p storage-pg flow_repository_tests -v`：通过，`3` 个测试
  - `node scripts/node/check-style-boundary.js page page.application-detail`：通过

## 1. 现状

### 1.1 现在开发情况和状态

- 当前真实主线已经不再是“准备做 `03/04`”，而是“`03/04` 已进入可运行实现”：
  - 工作台应用列表、应用详情四分区、`orchestration` 编排入口已经真实存在
  - `agentFlow` editor 已具备默认 Draft、保存、历史恢复、容器子画布、节点配置与基础校验
- 最近 `24` 小时的推进速度仍然很快，说明项目并不处于停滞或反复返工期。
- 但当前推进不再只是“功能有没有在写”，而是进入了“真值层是否还能跟上”的阶段。

### 1.2 对当前开发健康来说是好还是差

- 如果只看交付速度：`好`
  - `43` 次提交、`03/04` 主线持续收口，且前端自动化通过。
- 如果看工程门禁和协作信号：`中偏弱`
  - 前端门禁绿，后端定向测试也绿，但统一后端验证脚本是红的。
  - 计划文档、模块状态和代码现实已经开始脱节。
- 当前更准确的判断不是“开发差”，而是：
  - `实现健康`
  - `治理信号亚健康`

### 1.3 本轮新增问题

#### 问题一：统一验证入口已经失去“单一真相”作用

- 证据：
  - `pnpm --dir web lint`、`pnpm --dir web test`、`pnpm --dir web/app build` 全部通过
  - `cargo test -p control-plane flow_service_tests -v`、`cargo test -p api-server application_orchestration_routes -v`、`cargo test -p storage-pg flow_repository_tests -v` 全部通过
  - 但 `node scripts/node/verify-backend.js` 直接失败在 `rustfmt --check`
- 这意味着什么：
  - 当前代码并不是“后端能力不可用”，而是“统一门禁脚本无法代表当前真实健康”
  - 在 AI 日更模式下，这会比单次格式问题更严重，因为后续每轮协作都会先看到假红灯
- 为什么是问题：
  - 一旦统一门禁不可信，后续 QA、计划验收和开发收尾都会转向“各自挑命令”，工程纪律会快速松动

#### 问题二：计划文档和模块状态板已经开始误导开发进度判断

- 证据：
  - `docs/superpowers/specs/1flowse/modules/README.md` 仍把 `03` 标成 `已确认待开发`、把 `04` 标成 `未来设计`
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md` 顶部状态仍写“待写 implementation plan”
  - `docs/superpowers/plans/2026-04-15-agentflow-editor.md` 里 `Step 3: Update style-boundary scenes and run the final verification suite` 仍未勾选，但后面的 `Commit` 已勾选
  - 该计划里曾记录 `storage-pg` 测试受本地 PostgreSQL 阻塞；而本轮实际执行 `cargo test -p storage-pg flow_repository_tests -v` 已通过
- 这意味着什么：
  - 当前“模块状态”“计划状态”“代码状态”已经不是同一套真值
  - 这会直接影响你后面按文档管理 AI 开发节奏，因为 plan 看起来像没收尾，但代码和测试已经往前走了
- 为什么是问题：
  - AI 时代的开发评估不能再只问“做了几页”，而要问“真值是不是同步”
  - 现在的风险是：代码进度快于状态同步速度

#### 问题三：性能债已经从“提醒”升级成结构性约束

- 证据：
  - 本轮生产构建主包达到 `5,191.42 kB`，gzip 后 `1,554.34 kB`
  - `web/app/src/app/router.tsx` 仍是同步导入所有页面，没有路由级 lazy load
  - `agentFlow` 最近新增了 `node-definitions.tsx`、`node-registry.tsx`、`NodeInspector.tsx`、画布与 binding-editor 家族，当前都被一起打进主应用装载链
- 这意味着什么：
  - 当前不是“包有点大”，而是“继续按现在方式堆功能，会把所有路由都拖入 editor 成本”
  - 即使用户只进入工作台或设置页，也要为越来越重的编排编辑器买单
- 为什么是问题：
  - 这类债一旦拖到 `05/06B` 再处理，拆分成本会显著高于现在
  - 性能债会开始影响产品感知，而不只是工程内部指标

### 1.4 从短期来看风险和收益

- 短期收益：
  - `Application -> orchestration -> agentFlow` 主路径已经具备真实演示价值
  - 前端和后端关键切面都已有自动化和定向测试证据，不是纯“看起来能跑”
- 短期风险：
  - 统一门禁红灯会持续制造误判
  - 计划与模块状态失真会让后续讨论建立在错误进度感上
  - 主包膨胀会让任何继续加 editor 能力的决策都带着隐藏成本

### 1.5 从长期来看软件健康和质量

- 长期正向点：
  - `Application` 宿主与 `agentFlow` editor 已经形成稳定的一等对象
  - 后端 `route / service / repository / mapper` 主分层还在
  - 当前主线已有可证明的测试覆盖，而不是纯手工试跑
- 长期风险点：
  - 如果统一门禁继续不可信，工程质量会被“局部命令绿”慢慢替代
  - 如果计划和模块状态继续落后，文档就会从“开发导航”退化成“历史记录”
  - 如果不尽快做懒加载和拆包，后续 `05/06B` 只会把当前 `5.19 MB` 主包继续推高

### 1.6 开发进度是如何

- 不适合再用旧人力时代“这一周开发了几个模块”的口径来评估。
- 在当前 AI 日更模式下，更应该看四个指标：
  - 今天有没有让主路径更完整
  - 今天有没有让统一门禁更可信
  - 今天有没有让计划和模块状态继续可用
  - 今天有没有减少未来继续加功能的系统性成本
- 按这个口径看：
  - 主线实现进度：`快`
  - 统一门禁健康：`一般`
  - 真值同步质量：`偏慢`
  - 性能与装载成本控制：`明显落后于功能速度`

### 1.7 产品方向定位是否清晰，是否正确，是否需要调整

- 长期方向本身没有错：
  - `Application` 作为宿主
  - `agentFlow` 作为第一条 authoring 主线
  - `publish-first` 作为最终产品目标
- 当前真正需要调整的不是方向，而是阶段表达：
  - 现在的现实不是“完整发布平台已进入均衡实现”
  - 而是“authoring baseline 已经落地，统一门禁、状态真值和装载成本需要先收口，然后再进入 `05/06B` 的产品证明”
- 所以结论是：
  - `方向正确`
  - `阶段表达需要收紧`

## 2. 可能方向

### 方向 A：继续保持 `03/04` 高速推进

- 继续扩 `agentFlow` 节点、面板、交互和编辑器能力

### 方向 B：先做一次真值与门禁同步

- 先把统一验证、计划状态、模块状态和当前阶段表达收口

### 方向 C：先做一次性能与装载面收口

- 优先做路由级 lazy load、主包拆分、减少 editor 对非编排路由的默认影响

### 方向 D：再补最小 `05/06B` 产品证明

- 在当前 authoring baseline 上补应用级 API Key、最小运行列表和发布边界

## 3. 不同方向的风险和收益

### 方向 A：继续保持 `03/04` 高速推进

- 收益：
  - 最快继续看到 editor 能力增长
  - 对当前开发动量最友好
- 风险：
  - `5.19 MB` 主包会继续恶化
  - 计划与模块状态失真会越来越严重
  - 统一门禁红灯会继续拖累每一轮收尾

### 方向 B：先做一次真值与门禁同步

- 收益：
  - 恢复“一个命令、一份计划、一张模块表”作为真实协作入口
  - 会显著降低下一轮 AI 协作成本
- 风险：
  - 短期功能增长看起来不明显
  - 需要花时间补状态同步，而不是只做新功能

### 方向 C：先做一次性能与装载面收口

- 收益：
  - 现在处理拆包，成本远低于 `05/06B` 之后再回头治理
  - 可以让工作台、设置页、应用详情壳层重新获得清晰的装载边界
- 风险：
  - 会碰到路由、构建和共享依赖边界，不是零成本小修
  - 如果做法不稳，可能短期影响路由或测试稳定性

### 方向 D：再补最小 `05/06B` 产品证明

- 收益：
  - 能把“publish-first”重新从口号拉回证据
  - 有助于验证当前产品定位没有跑偏成纯编辑器
- 风险：
  - 如果先不做 B/C，就会把门禁失真和装载成本一起带进新模块
  - 容易出现“能力更多，但真值更散”的情况

## 4. 对此你建议是什么？

我的建议顺序是：`先 B，再 C，再 D，最后再回到 A`。

### 建议一：在下一轮开发前先恢复统一真值

- 先修 `node scripts/node/verify-backend.js` 的 `rustfmt --check` 红灯
- 同步更新：
  - `docs/superpowers/specs/1flowse/modules/README.md`
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
  - `docs/superpowers/plans/2026-04-15-agentflow-editor.md`
- 目标不是“补文档好看”，而是让计划、模块状态和真实验证结果重新对齐

### 建议二：立即把性能债从“以后再说”改成当前任务

- 先从 `web/app/src/app/router.tsx` 做路由级 lazy load
- 优先把 `ApplicationDetailPage`、`AgentFlowEditorPage`、`SettingsPage`、`EmbeddedAppsPage`、`ToolsPage` 从主入口同步导入中拆出去
- 必要时再配合 `manualChunks`，但不要先靠提高 chunk warning limit 掩盖问题

### 建议三：把“进度判断方式”从模块名切到证据闭环

- 对内评估时，不再用“03 做完没、04 做完没”这种旧口径
- 改成三类看板：
  - `主路径闭环`
  - `统一门禁`
  - `状态真值同步`
- 这样更适合 AI 日更节奏，也更符合当前项目实际推进方式

### 建议四：产品方向不改，但阶段表述必须收紧

- 对外和对内都建议明确当前阶段是：
  - `Application-hosted agentFlow authoring baseline 已落地`
  - `下一阶段补 05/06B 的最小产品证明`
- 不要继续让模块总览和计划文档给人“03 还未开发、04 还只是未来设计”的错觉

### 建议五：等 B/C 收口后，再进入最小 `05/06B` 证明

- 推荐的最小证明顺序：
  - 应用级 API Key 读写基线
  - 最小 `Application Run List`
  - `publish-gateway` 的真实接口边界
- 这样能最快证明方向，同时避免现在就把更多能力压进已经过重的主包里

## 受限项

- `style-boundary` 初次执行时因本地 dev server 绑定 `0.0.0.0:3100` 受限而超时；在允许启动本地端口后，`page.application-detail` 检查通过
- 当前工作树仍有未提交改动：`web/app/src/features/agent-flow/components/editor/agent-flow-editor.css`
