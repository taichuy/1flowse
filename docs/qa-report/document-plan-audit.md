# 文档计划审计优化报告

更新时间：`2026-04-17 03:08 CST`

审计模式：`qa-evaluation / project evaluation`

审计输入：

- 最近 `24` 小时 `git` 提交与当前工作树
- `.memory/AGENTS.md`、`.memory/user-memory.md`
- 相关项目记忆全文：
  - `.memory/project-memory/2026-04-15-module-03-application-shell-plan-stage.md`
  - `.memory/project-memory/2026-04-15-module-04-editor-first-pass-direction.md`
  - `.memory/project-memory/2026-04-16-agentflow-editor-store-centered-restructure-direction.md`
  - `.memory/project-memory/2026-04-16-agentflow-node-detail-design-direction.md`
  - `.memory/project-memory/2026-04-16-agentflow-node-detail-plan-stage.md`
- `docs/superpowers` 相关模块文档、计划与产品设计
- 当前代码结构、目录压力、文件规模

本轮新增验证：

- `pnpm --dir web lint`
- `pnpm --dir web/app build`
- `cargo fmt --all --check`
- `pnpm --dir web/app exec vitest run src/features/agent-flow/_tests/node-detail-panel.test.tsx src/features/agent-flow/_tests/agent-flow-editor-page.test.tsx src/features/applications/_tests/application-list-page.test.tsx`

本轮受限项：

- 没有运行 `style-boundary` 浏览器级回归，因此前端 UI / 样式边界结论只下到代码和命令证据层
- 没有跑完整 `verify-backend.js`，因此后端只确认到格式门禁未通过，不扩写为“后端逻辑整体失败”

## 1. 现状

### 1.1 现在开发情况和状态

- 最近 `24` 小时共有 `33` 次提交：
  - `docs`: `15`
  - `feat`: `9`
  - `refactor`: `5`
  - `fix`: `3`
  - `test`: `1`
- 最近 `24` 小时真实投入高度偏向 `agent-flow`：
  - 命中 `web/app/src/features/agent-flow` 的文件记录：`165`
  - 命中 `web/app/src/features/applications`：`6`
  - 命中 `api/`：`12`
  - 命中 `docs/qa-report/document-plan-audit.md`：`9`
  - 命中 `docs/userDocs/todolist/document-plan-audit.md`：`9`
- 当前工作树只脏在两份审计文档，说明上一轮“`node detail` 还停留在未提交工作树”的结论已经失效。
- 当前 `HEAD` 已经是 `2af40f3c 2026-04-17 01:12:39 +0800 feat: revise agentflow node detail panel`。

### 1.2 当前代码已经走到哪里

- `03` 已经不是“待开发”：
  - 首页直接渲染 `ApplicationListPage`，见 `web/app/src/features/home/pages/HomePage.tsx`
  - 路由已包含 `/applications/:applicationId/{orchestration|api|logs|monitoring}`，并将应用根路由重定向到 `orchestration`，见 `web/app/src/app/router.tsx`
  - 应用列表页已支持类型筛选、标签筛选、编辑、标签管理，见 `web/app/src/features/applications/pages/ApplicationListPage.tsx`
  - 后端已经不止 `GET/POST/GET detail`，还存在 `catalog`、`tags`、`patch`，见 `api/apps/api-server/src/routes/applications.rs`
- `04` 也已经不是“未来设计”：
  - 编排读取、保存 Draft、恢复版本三条正式路由已存在，见 `api/apps/api-server/src/routes/application_orchestration.rs`
  - `node detail panel revision` 已在代码中落成 `Splitter` 停靠结构，见 `web/app/src/features/agent-flow/components/editor/AgentFlowCanvasFrame.tsx`
- `05` 与 `06B` 仍然没有最小外部价值闭环：
  - `05` 仍是运行时模型设计基线，未形成可用运行实例链路
  - `06B` 仍是未来设计，`Publish Endpoint` 与对外调用尚未进入正式实现

### 1.3 当前开发健康是好还是差

结论：`实现速度好，项目治理偏弱，产品主线对齐不足`

- 好的部分：
  - `03/04` 已经形成真实垂直切片，不再是纯 spec
  - 关键功能推进伴随测试补充，而不是完全裸奔
  - `node detail` 的大方向争议已经进入提交态，不再停在讨论态
- 差的部分：
  - 文档真值层仍明显落后于代码
  - 审计文档刷新频率很高，但没有稳定承担“最新事实摘要”
  - 产品目标是 `publish-first`，而近几轮实际执行仍是 `editor-first`

健康度判断：

- 开发速度：`好`
- 垂直切片积累：`好`
- 文档真值同步：`差`
- 工程门禁稳定性：`中下`
- AI 检索效率：`中下`
- 北极星对齐度：`中`
- 对外价值推进：`弱`

### 1.4 本轮新证据

- `pnpm --dir web lint`：通过，但仍有 `1` 条 warning
  - `web/app/src/features/agent-flow/store/editor/provider.tsx`
  - 类型：`react-refresh/only-export-components`
- `pnpm --dir web/app build`：通过，但构建警告仍明确提示 chunk 过大
  - 主包：`dist/assets/index-wiO3B5Br.js = 5,268.92 kB`
  - gzip：`1,572.14 kB`
  - `vite` 明确建议 `dynamic import()` 或 `manualChunks`
- 定向 Vitest：通过，`3` 个文件 `15` 个测试全绿
  - 但测试 stderr 仍反复出现：
    - `React Flow parent container needs a width and a height`
    - `Please import '@xyflow/react/dist/style.css'`
    - `antd Tooltip overlayInnerStyle is deprecated`
- `cargo fmt --all --check`：失败
  - 失败不是逻辑断言，而是格式门禁未收口
  - 影响文件集中在最近新增的 application / orchestration / storage-pg 相关代码

### 1.5 当前最值得指出的问题

#### 问题一：文档真值层已经失真，不是“慢半拍”，而是多处口径互相打架

证据：

- 模块总览仍把 `03` 标成 `已确认待开发`、`04` 标成 `未来设计`，见 `docs/superpowers/specs/1flowse/modules/README.md`
- `03` README 仍写“当前首页仍是工作台正式空态”“前后端还没有 Application 列表、创建、详情和四分区路由”，见 `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
- 但代码事实已经相反，见：
  - `web/app/src/features/home/pages/HomePage.tsx`
  - `web/app/src/app/router.tsx`
  - `api/apps/api-server/src/routes/applications.rs`
  - `api/apps/api-server/src/routes/application_orchestration.rs`
- `03` README 头部状态仍是“待写 implementation plan”，而 `.memory/project-memory/2026-04-15-module-03-application-shell-plan-stage.md` 已明确 plan 已落盘；代码又已经继续落地，形成“三层真相不一致”
- `04` 模块 README 自己写的是“已完成旧讨论”，根模块总览却写“未来设计”，说明文档内部也没有单一真相层

为什么这是问题：

- 后续所有“做到哪了、下一步做什么、是否偏航”的判断，都会先被旧文档带偏
- 在 AI 日更节奏下，真值层失真会比实现缺口更贵，因为它会反复制造错误上下文

#### 问题二：`03` 已经从“宿主壳层”扩到了“应用运营面”，但模块边界和计划没有同步重写

证据：

- `03` README 明确说当前只保留最小 `Application` 列表、创建、详情壳层与 future hooks
- 但真实代码已经包含：
  - 类型筛选
  - 标签筛选
  - 标签创建
  - 应用编辑
  - `PATCH /applications/:id`
  - 应用目录 `catalog`
- 这些能力本身合理，但已经超出“最小壳层”表述

为什么这是问题：

- 这不是功能做错，而是模块 owner 和范围说明已经落后
- 如果不重写边界，`03` 会越来越像“所有应用运营功能的吸附层”

#### 问题三：近 `24` 小时的主投入仍明显偏向 editor，而不是 P1 的 publish/runtime 闭环

证据：

- 最近 `24` 小时：
  - `agent-flow commits`: `17`
  - `applications commits`: `1`
  - `api commits`: `1`
- 产品设计明确写的是：
  - `Flow` 是核心资产
  - `Publish Endpoint` 是核心交付物
  - P1 要证明“建出来、发出去、跑起来、查得到、控得住”
- 但 `05` / `06B` 仍没有最小链路实现证据

为什么这是问题：

- 当前项目越来越像“完成度很高的编辑器”
- 但 P1 真正要证明的是“外部可调用”和“运行时可恢复”
- 方向没错，排序错了

#### 问题四：审计系统本身开始变成噪声源

证据：

- 最近 `24` 小时两份审计文档各被刷新 `9` 次
- 但本轮开始前，主题还在沿用已经过期的“`node detail` 未提交”判断
- 当前真正重要的问题已经变成“文档和记忆没有跟上 `HEAD`”

为什么这是问题：

- 审计文档本来应该缩短理解时间，现在却开始制造高频旧结论
- 这会让用户和后续 AI 都先读到过期风险，而不是当前约束

#### 问题五：工程门禁不是全红，但已经出现“局部可用，正式门禁不稳”的裂缝

证据：

- 前端 lint / build / 定向测试都能通过
- 但：
  - lint 仍有 `Fast Refresh` warning
  - build 仍有超大 chunk warning
  - 测试 stderr 仍有 `React Flow` 容器与样式提示、`Tooltip` 弃用提示
  - 后端 `cargo fmt --all --check` 直接失败

为什么这是问题：

- 当前状态更像“局部行为已成立”，不是“工程门禁可以稳定代表完成标准”
- 如果继续接受这种状态，后续每轮收尾都得人工解释“为什么黄灯也算过”

#### 问题六：AI 检索系统的收纳压力已经进入真实风险区

证据：

- `.memory/project-memory`：`65` 个文件
- `docs/superpowers/plans/history`：`22` 个文件
- `docs/superpowers/specs/history`：`20` 个文件
- `web/app/src/features/agent-flow/_tests`：`16` 个文件
- `web/app/src/features/agent-flow`：`90` 个文件
- 多份计划文档已超过本地规则建议上限：
  - `docs/superpowers/plans/2026-04-15-module-03-application-shell.md`：`2335` 行
  - `docs/superpowers/plans/2026-04-15-agentflow-editor.md`：`2188` 行
  - `docs/superpowers/plans/2026-04-16-agentflow-editor-store-centered-restructure.md`：`2024` 行
  - `docs/superpowers/plans/2026-04-16-agentflow-node-detail.md`：`1734` 行

为什么这是问题：

- 现在的噪声已经不只是业务代码，而是“文档系统自己开始难检索”
- 在 AI 驱动开发里，这类噪声会直接放大为误读、漏读和重复劳动

### 1.6 从短期看风险和收益

短期收益：

- `03/04` 的基础盘已经很厚，继续推进 `05/06B` 不需要再回头补壳层
- `node detail` 已经正式进入提交态，不再是“纸面方案”
- 关键前端路径的定向测试本轮仍通过

短期风险：

- 若继续按旧文档推进，会把已完成问题重新当成未完成问题
- 若继续 editor-first，P1 的外部价值证明会继续后移
- 若工程门禁不收，后续每次完成定义都会越来越依赖人工解释

### 1.7 从长期看软件健康和质量

长期正向点：

- 前后端还没有出现明显的边界塌陷
- `03` 和 `04` 都已有真实代码锚点，后续不是从零开始
- 测试随着功能推进在持续增长

长期风险点：

- `真值债`：模块总览、模块 README、计划、记忆、审计没有单一事实层
- `检索债`：记忆碎片、计划超长、history 目录过满
- `交付债`：前端包体、warning、弃用噪声会拖慢后面每一轮开发
- `方向债`：产品北极星是 publish-first，但局部最优化长期发生在 editor

### 1.8 现在开发进度该怎么评估

不建议再用旧人力时代的“完成百分比”来评估。

更适合 AI 时代的评估口径：

1. 最近 `24` 小时是否形成了新的可复用垂直切片。
2. 当前真值层是否稳定，后续 AI 能否无歧义接上。
3. 当前推进是否在缩短到 P1 闭环的距离。
4. 新增文档和记忆是在降噪，还是在制造噪声。

按这个口径看当前项目：

- 不是慢，而是 `快`
- 不是没进展，而是 `03/04` 进展很明显
- 真正的问题是 `对外价值闭环仍未追上内部构建速度`

### 1.9 产品方向定位是否清晰、是否正确、是否需要调整

结论：`方向清晰，定位正确，不需要 pivot；需要调整的是执行排序`

- 当前定位仍然成立：`以标准 Agent API 发布为中心的 AI 工作流平台`
- 当前不需要改产品定义
- 当前需要改的是执行顺序：
  - 少一轮 editor 深挖
  - 多一轮 `05/06B` 最小闭环

### 1.10 建议清理或合并哪些记忆，以提升 AI 检索效率

优先级最高的不是新增记忆，而是合并碎片。

建议优先合并：

1. `03 Application` 主题
   - 合并：
     - `.memory/project-memory/2026-04-15-module-03-application-shell-plan-stage.md`
     - `.memory/project-memory/2026-04-15-module-03-application-shell-needs-future-hooks.md`
   - 目标：只保留一条“`03` 当前实现状态 + future hooks + 边界变化”的现行记忆

2. `04 agentFlow editor` 主题
   - 合并：
     - `.memory/project-memory/2026-04-15-module-04-editor-first-pass-direction.md`
     - `.memory/project-memory/2026-04-16-agentflow-editor-store-centered-restructure-direction.md`
     - `.memory/project-memory/2026-04-16-agentflow-editor-store-centered-restructure-plan-stage.md`
   - 目标：把“第一版产品方向”和“第二版实现架构”压成一条当前真值

3. `node detail` 主题
   - 合并：
     - `.memory/project-memory/2026-04-16-agentflow-node-detail-design-direction.md`
     - `.memory/project-memory/2026-04-16-agentflow-node-detail-plan-stage.md`
   - 目标：从“设计态 + 计划态”收成“已进提交态的当前结论”

4. `agentFlow follow-up` 主题
   - 合并：
     - `.memory/project-memory/2026-04-16-agentflow-branching-and-edge-deletion-follow-up.md`
     - `.memory/project-memory/2026-04-16-agentflow-handle-first-source-trigger-follow-up.md`
   - 目标：把局部 follow-up 压成一条“04 交互尾项清单”

5. 本地前端验证环境主题
   - 合并：
     - `.memory/tool-memory/vite/2026-04-14-web-app-dev-port-3100-requires-escalation.md`
     - `.memory/tool-memory/vite/2026-04-15-web-app-dev-port-3100-already-in-use-reuse-existing-vite.md`
     - `.memory/tool-memory/node/2026-04-17-dev-up-ensure-timeout-use-pty-vite-for-browser-check.md`
     - `.memory/tool-memory/style-boundary/2026-04-16-networkidle-timeout-on-vite-dev-server.md`
   - 目标：合成一条“本地 dev-up / style-boundary 运行前置条件”

当前不建议优先动：

- `feedback-memory`
- `reference-memory`

原因：

- 它们现在不是主要噪声源
- 当前噪声核心在 `project-memory` 和部分环境型 `tool-memory`

## 2. 可能方向

### 方向 A：先做真值治理

- 更新模块总览、`03`、`04` 当前状态
- 更新当前审计主题，清理已过期判断
- 将“代码事实 > 历史讨论稿”重新写成单一入口

### 方向 B：下一条主切片直接补最小 `05/06B`

- 目标固定为“可发布、可调用、可看到最小运行结果”
- 不再默认把主精力放到 editor 局部细节

### 方向 C：先做工程治理

- 收紧文档和记忆结构
- 收掉前端 chunk / warning / deprecation 噪声
- 把后端格式与验证入口重新拉回可用状态

### 方向 D：继续 editor-first 深挖

- 继续完善 node detail、画布交互、局部体验
- 让 `04` 的 authoring 面越来越完整

## 3. 不同方向的风险和收益

### 方向 A：真值治理优先

收益：

- 后续每次决策都会更准
- AI 检索效率会立刻改善
- 审计文档不再反复输出旧结论

风险：

- 短期用户感知到的新功能较少
- 如果做过头，会再次演变成只写文档

### 方向 B：最小 `05/06B` 优先

收益：

- 最快回到产品北极星
- 最早证明“这是 publish-first 平台，不只是 editor”

风险：

- 如果不先做最小真值治理，会带着旧文档推进关键主线
- 旧噪声会被带进更重要的交付链路

### 方向 C：治理优先

收益：

- 对长期软件健康最有利
- 可以显著降低后续 QA、交接、回归成本

风险：

- 短期看起来不像“功能推进”
- 如果治理目标不收敛，容易拖长节奏

### 方向 D：继续 editor-first

收益：

- `04` 的体验会继续提升
- 局部演示观感会更强

风险：

- 继续偏离 P1 的 publish/runtime 闭环
- 项目会越来越像“精致编辑器”而不是“可发布平台”
- 文档和记忆噪声会继续放大

## 4. 对此你建议是什么？

建议顺序：`A-lite -> B -> C`，不建议继续走 `D`

### 现在先做

1. 做一轮最小真值治理，只改高价值入口，不大规模重写：
   - `docs/superpowers/specs/1flowse/modules/README.md`
   - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
   - `docs/superpowers/specs/1flowse/modules/04-chatflow-studio/README.md`
   - 当前 `document-plan-audit` 主题
2. 把 `node detail revision` 明确标记为“已提交基线”，下一轮不再默认继续深挖 editor
3. 合并高噪声记忆，优先做上面列出的 `03 / 04 / node detail / local dev verification` 四组

### 紧接着做

1. 下一条主切片直接补最小 `05/06B`
2. 切片范围固定为：
   - 有一个 `Application`
   - 有一个 `agentFlow Draft`
   - 有一个最小发布入口
   - 能发起一次外部调用
   - 能留下最小 `Flow Run / Node Run` 可见结果

### 随后做

1. 前端进入一轮低成本治理：
   - 路由懒加载
   - 基础 chunk 策略
   - 清理 `Fast Refresh` / `Tooltip` 弃用噪声
2. 后端把 `fmt -> clippy -> test -> check` 重新拉回稳定标准
3. 文档目录继续收纳：
   - `plans/history` 和 `specs/history` 继续下沉一层
   - 超过 `1500` 行的计划文档拆成“总览 + 子任务”

### 当前不建议做

1. 继续频繁刷新同一个审计主题，但不清理旧结论
2. 继续把主要精力投到 editor 微优化
3. 继续容忍模块总览、项目记忆、计划文档和当前代码各说各话
