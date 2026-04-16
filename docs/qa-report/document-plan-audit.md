# 文档计划审计优化报告

更新时间：`2026-04-16 08:05 CST`

说明：本轮继续沿用同主题滚动更新，只补充上一版没有展开或已经发生变化的判断。上一轮关于“状态真值漂移”“统一门禁分裂”“文档维护税”仍然成立；本轮重点新增三件事：

- `04 agentFlow` 已经不是“未来设计”，而是“功能可跑、实现架构未冻结”
- 当前真正的风险中心从“有没有做”转成“阶段表达是否失真、实现边界是否收口”
- 工作树稳定性较上一轮明显改善，但产品价值闭环仍停在 `03/04`，还没有推进到 `05/06B`

审计输入：

- `git` 时间窗口：`2026-04-15 08:05 CST` 到 `2026-04-16 08:05 CST`
- 最近 `24` 小时提交数：`47`
- 最近 `24` 小时触达文件数：`188`
- 最近 `24` 小时提交结构：
  - `docs`：`14`
  - `feat`：`9`
  - `feat(web)`：`5`
  - `fix(web)`：`4`
  - `feat(api)`：`3`
- 最近 `24` 小时最活跃文件：
  - `web/app/src/features/agent-flow/_tests/agent-flow-editor-page.test.tsx`：`8` 次
  - `docs/superpowers/plans/2026-04-15-module-03-application-shell.md`：`8` 次
  - `docs/superpowers/plans/2026-04-15-agentflow-editor.md`：`8` 次
  - `web/app/src/features/agent-flow/components/editor/agent-flow-editor.css`：`7` 次
  - `web/app/src/features/agent-flow/components/editor/AgentFlowEditorShell.tsx`：`7` 次
- 本轮已运行验证：
  - `pnpm --dir web lint`：通过；`node-registry.tsx` 仍有 `4` 条 `react-refresh/only-export-components` warning
  - `pnpm --dir web test`：通过；`30` 个测试文件、`89` 个测试全部通过
  - `pnpm --dir web/app build`：通过；主包 `dist/assets/index-Csuvz6RI.js` 仍为 `5,192.02 kB`，gzip 后 `1,554.40 kB`
  - `node scripts/node/verify-backend.js`：失败；卡在 `rustfmt --check`
  - `cargo test -p control-plane flow_service_tests`：通过；`2` 个测试
  - `cargo test -p api-server application_orchestration_routes`：通过；`1` 个测试
  - `cargo test -p storage-pg flow_repository_tests`：通过；`3` 个测试
- 本轮未覆盖项：
  - 未拿到新的浏览器级 `style-boundary` 运行结果；UI 质量结论仍是受限结论
- 当前工作树：
  - 仅剩 `web/app/src/features/agent-flow/components/editor/agent-flow-editor.css` 处于修改态

## 1. 现状

### 1.1 现在开发情况和状态

- 当前真实代码状态已经进入：
  - `03 Application 宿主基线已落地`
  - `04 agentFlow authoring baseline 已落地`
  - `05/06B` 仍未形成最小产品证明
- 直接证据已经足够明确：
  - 前端已有 `ApplicationListPage`、`ApplicationDetailPage`、`AgentFlowEditorPage`
  - 路由已存在 `/applications/:applicationId/orchestration|api|logs|monitoring`
  - 后端已有 `GET /api/console/applications/:id/orchestration`、`PUT draft`、`POST restore`
  - 前后端定向测试覆盖了 `Application` 列表/详情和 `agentFlow` 的 draft/save/restore 主路径
- 最近 `24` 小时的主线不是“还在做壳层”，而是：
  - 补 `agentFlow` 的可编辑能力
  - 修 editor 交互
  - 为 editor 做下一步 store-centered 重构设计

### 1.2 本轮新增或升级的问题

#### 问题一：项目状态字段把“设计完成”和“实现完成”混成了一层，进度表达继续失真

- 证据：
  - `docs/superpowers/specs/1flowse/modules/README.md` 仍把：
    - `03` 标成 `已确认待开发`
    - `04` 标成 `未来设计`
  - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md` 仍写：
    - 当前还没有 `Application` 列表、创建、详情和应用内四分区路由
  - `docs/superpowers/specs/1flowse/modules/04-chatflow-studio/README.md` 又写成：
    - 状态 `已完成`
  - 但当前代码和测试已经明确存在 `Application` 宿主与 `agentFlow` editor 第一版
- 这轮更深一层的问题不是“文档落后”而已，而是：
  - 同一个 `状态` 字段同时承载了“设计稿定稿”和“代码已落地”
  - 结果就是 `04` 既可能被读成“未来设计”，也可能被读成“已完成”
- 为什么是问题：
  - 这会直接扭曲资源排序
  - 在 AI 日更节奏里，真正需要的是“当前已验证基线是什么”，而不是一个混合状态值

#### 问题二：`04 agentFlow` 已可用，但实现架构还没有冻结，当前最大风险在边界分散

- 证据：
  - `2026-04-16 07:53` 新增了 `docs/superpowers/specs/1flowse/2026-04-16-agentflow-editor-store-centered-restructure-design.md`
  - 该设计稿明确指出当前问题：
    - `AgentFlowEditorShell.tsx` 同时持有文档状态、autosave、restore、selection、drawer 开关等多种职责
    - `AgentFlowCanvas.tsx` 直接承担 graph 写操作
    - `NodeInspector.tsx` 直接做 document mutation
    - `node-registry.tsx` 仍使用 `window.dispatchEvent('agent-flow-insert-node')` 作为交互桥
  - 当前 lint warning 也继续集中在 `node-registry.tsx`
- 这说明什么：
  - `04` 不是“没做出来”，而是“做出来了，但第一版实现边界还没收口”
  - 当前已经从产品问题切换成实现架构问题
- 为什么是问题：
  - 继续只堆功能，会把 `connect / reconnect / delete / duplicate / container` 等命令继续分散在 UI 组件里
  - 到那一步，editor 维护成本会比继续加功能更快上涨

#### 问题三：产品总方向没有错，但当前阶段表述仍然过度接近 P1 闭环，容易误判产品进度

- 证据：
  - `docs/superpowers/specs/1flowse/2026-04-10-product-requirements.md` 的 P1 目标仍然围绕：
    - `Flow Run / Node Run`
    - `Publish Endpoint`
    - 外部调用
    - 日志与监控
  - 最近 `24` 小时实际实现几乎全部集中在：
    - `Application` 宿主
    - `agentFlow` authoring
    - draft/save/restore
  - `05` 和 `06B` 仍没有新的最小产品闭环实现
- 这说明什么：
  - 当前项目方向本身是对的
  - 但真实阶段应该被描述为：
    - `Application-hosted authoring baseline stabilization`
  - 还不能直接用“P1 闭环正在整体收尾”的口径
- 为什么是问题：
  - 如果阶段口径不改，项目会看起来像“只差一点”
  - 实际上距离外部可调用价值证明还有一整段 `05/06B` 没做

#### 问题四：验证成熟度正在改善，但仍然不是单一可信真相

- 证据：
  - 前端：
    - `lint` 绿
    - `test` 绿
    - `build` 绿
  - 后端：
    - 三条定向测试都绿
    - 但 `verify-backend.js` 仍红，原因是 `rustfmt --check`
  - 前端运行时 UI 门禁：
    - 本轮没有新的浏览器级 `style-boundary` 成功证据
- 为什么这和上一轮不同：
  - 上一轮更像“统一门禁红、局部行为绿”
  - 这一轮已经能更明确地下结论：
    - `功能行为大体成立`
    - `官方统一门禁仍未恢复`
    - `UI 运行时质量门禁证据仍偏弱`
- 为什么是问题：
  - 没有统一门禁，收尾标准还是要靠人工解释
  - 没有新浏览器证据，就不能把 UI 质量判成正式通过

#### 问题五：文档系统仍在吃开发额度，而且已经开始打破本地目录治理规则

- 证据：
  - 最近 `24` 小时 `47` 次提交里，`docs` 类提交有 `14` 次
  - 两份主 implementation plan 各被改了 `8` 次
  - 体量：
    - `docs/superpowers/plans/2026-04-15-module-03-application-shell.md`：`2335` 行
    - `docs/superpowers/plans/2026-04-15-agentflow-editor.md`：`2188` 行
    - `docs/superpowers/specs/1flowse/2026-04-16-agentflow-editor-store-centered-restructure-design.md`：`905` 行
  - 目录压力：
    - `docs/superpowers/plans/history`：`22` 个文件
    - `docs/superpowers/specs/history`：`20` 个文件
    - `api/crates/control-plane/src`：`16` 个文件，已轻微超过单目录 `15` 个文件约束
- 为什么是问题：
  - 文档已经不是“同步一下状态”，而是在参与主开发流
  - 如果不减重，AI 协作会越来越多地先维护计划和审计，再判断代码

### 1.3 对当前开发健康来说是好还是差

- 如果只看功能推进：`好`
  - `03/04` 在一天内已经从文档推进成真实可跑垂直切片
  - 前端主路径有了稳定自动化测试
  - 当前工作树只剩 `1` 个修改文件，稳定性明显好于上一轮
- 如果看工程治理：`中等偏弱`
  - editor 架构边界仍在波动
  - 后端统一门禁还没回绿
  - UI 运行时质量证据不够
  - 文档系统过重
- 更准确的判断是：
  - `实现健康`
  - `治理偏弱`
  - `产品阶段表达不清`

### 1.4 从短期来看风险和收益

- 短期收益：
  - 现在已经有一条真实可验证的主线：
    - `工作台应用列表 -> 应用详情 -> orchestration -> 默认 Draft -> 保存 / 历史 / 恢复`
  - 这条主线不是空壳：
    - 前端测试通过
    - 后端定向测试通过
    - 前后端 API 已打通
- 短期风险：
  - 如果不先收口 editor store/command 边界，继续加交互会迅速放大维护成本
  - 如果不先修状态真值层，后续关于“做到哪、该先做什么”的讨论仍会失真
  - 如果继续只做 `04`，产品会越来越像“编辑器项目”，而不是“可交付 AI 应用平台”

### 1.5 从长期来看软件健康和质量

- 长期正向点：
  - 代码文件体量仍在可控范围内：
    - 本轮新增主线文件基本都在 `500` 行内
    - `NodeInspector.tsx` `418` 行、`AgentFlowCanvas.tsx` `404` 行、`node-definitions.tsx` `485` 行
  - 后端分层没有塌：
    - `domain / control-plane / storage-pg / api-server` 仍然成立
  - 测试纪律还在：
    - 前端测试继续进入 `_tests`
    - 新增后端能力配了定向测试
- 长期风险点：
  - `web/app` 主包 `5.19 MB`，说明未来如果再叠 editor、runtime、logs，会很快进入性能债
  - `style-boundary` 浏览器级回归如果长期缺位，UI 会变成“代码看起来对，但运行时没证据”
  - `api/crates/storage-pg/src/model_definition_repository.rs` 已有 `1181` 行，后续很可能成为下一处体量压力点
  - 计划和历史目录继续膨胀，会形成“判断债”，不是代码债

### 1.6 开发进度应该如何评估，不要再用旧人力时代口径

- 当前不建议继续用“模块百分比完成度”来判断进度
- AI 日更阶段更适合看四个指标：
  - `已验证垂直切片数量`
  - `统一门禁可信度`
  - `状态真值同步延迟`
  - `实现架构波动幅度`
- 按这个口径看当前项目：
  - 已验证垂直切片：`快`
    - `03 Application host`
    - `04 agentFlow authoring baseline`
  - 统一门禁可信度：`中`
    - 前端高，后端官方门禁低
  - 状态真值同步延迟：`高`
    - 模块文档仍落后代码事实
  - 实现架构波动幅度：`高`
    - editor 已经进入 store-centered 重构前夜
- 所以当前进度不该被描述成“慢”：
  - 它是 `推进很快`
  - 但还不是 `阶段稳定`

### 1.7 产品方向定位是否清晰，是否正确，是否需要调整

- 当前产品大方向仍然正确：
  - `Application` 作为一级宿主
  - `agentFlow` 作为第一条 authoring 主线
  - `runtime / publish` 作为后续产品闭环
- 需要调整的不是方向，而是阶段表述和节奏：
  - 北极星目标继续保留：
    - `可发布、可调用、可观测的 AI 应用平台`
  - 当前阶段口径应显式改成：
    - `先稳定宿主 + editor authoring baseline`
    - `再补最小 runtime / publish proof`
- 如果不调整口径，会产生两个误判：
  - 外部看起来像“平台快闭环了”
  - 内部实际上还在 editor 基建阶段

## 2. 可能方向

### 方向 A：重建状态真值层

- 拆开：
  - `设计状态`
  - `实现状态`
  - `已验证基线`
  - `下一阶段`
- 更新：
  - `product requirements`
  - `modules/README`
  - `03 README`
  - `04 README`

### 方向 B：优先完成 `agentFlow` store-centered 重构

- 目标：
  - 建立 `editor store`
  - 抽离 `document transforms`
  - 用 `interaction hooks` 接管 graph mutation
  - 移除 `window.dispatchEvent` 这类全局事件桥

### 方向 C：恢复统一门禁和运行时 QA 可信度

- 目标：
  - 让 `verify-backend.js` 回到可绿状态
  - 给 `style-boundary` 提供一个当前环境下可执行的正式路径
  - 让“官方门禁”和“定向测试”重新合一

### 方向 D：补最小 `05/06B` 产品证明

- 最小切片可以是：
  - 应用级 `API Key`
  - 最小 `Run List / Run Detail`
  - `Publish Endpoint` 骨架和真实边界

### 方向 E：继续只追 editor 的可见功能

- 继续补：
  - 节点能力
  - 画布交互
  - inspector 细节
  - 发布按钮周边 UI

## 3. 不同方向的风险和收益

### 方向 A：重建状态真值层

- 收益：
  - 后续所有“项目做到哪、该先做什么”的讨论会回到同一真值层
  - AI 协作的判断成本会明显下降
- 风险：
  - 短期用户可见功能变化不大

### 方向 B：先做 store-centered 重构

- 收益：
  - 可以把当前 editor 从“能跑”升级成“能持续扩展”
  - 后续 `connect / duplicate / delete / container` 等命令才有稳定挂点
- 风险：
  - 近两天会有明显的结构性重排成本
  - 如果执行不严谨，可能短期影响当前已通过的 editor 回归

### 方向 C：先做统一门禁收口

- 收益：
  - 能把“局部测试通过”和“官方门禁通过”重新统一
  - QA 结论会更硬，不需要大量口头解释
- 风险：
  - 短期主要投入在格式、脚本和执行路径治理，不会直接增加新能力

### 方向 D：先补 `05/06B`

- 收益：
  - 可以最快证明项目没有偏成纯 editor
  - 开始接近真实外部价值闭环
- 风险：
  - 如果不先做 A/B/C，会把状态失真、编辑器边界散乱和门禁问题直接带进新模块

### 方向 E：继续只追 editor 日更

- 收益：
  - 用户能最快看到功能变化
  - 短期演示感会最强
- 风险：
  - 会继续放大实现边界分散
  - 会继续推迟 runtime/publish 价值证明
  - 会把项目叙事进一步锁死在“编辑器越来越强”，而不是“产品闭环越来越近”

## 4. 对此你建议是什么？

建议顺序：`A + B 同步启动 -> C 跟进收口 -> D 做最小产品证明 -> 最后再继续 E`

### 我建议你现在先做的事

1. 立刻重写状态真值层
   - 不再用一个 `状态` 字段混写设计完成和实现完成
   - 模块文档至少增加：`设计状态 / 实现状态 / 已验证基线 / 下一阶段`
2. 把 `04 agentFlow` 明确改口径为：
   - `功能基线已落地`
   - `前端实现架构待收口`
3. 直接执行 `store-centered` 重构
   - 先抽 `editor store`
   - 再抽 `document transforms`
   - 再把 `canvas / inspector / node-registry` 的写操作回收到 hooks/commands
4. 让 `verify-backend.js` 回绿
   - 当前阻塞点已经非常明确，就是 `rustfmt --check`
   - 这类问题不应继续留在统一门禁入口
5. 给 UI 运行时门禁一条固定执行路径
   - 要么把当前环境的 `style-boundary` 路径稳定下来
   - 要么明确标记“当前轮 UI 质量只给受限结论”

### 我建议随后做的事

1. 在 `03/04` 收口后，尽快补一个最小 `05/06B` 价值证明
   - `Application API Key`
   - `Run List / Run Detail`
   - `Publish Endpoint` 骨架
2. 改用 AI 时代的进度面板，而不是旧式完成率
   - `已验证垂直切片`
   - `门禁可信度`
   - `状态同步延迟`
   - `实现架构波动`

### 当前不建议优先做的事

1. 继续把 `04` 说成“未来设计”或“已经完成”
2. 继续接受“统一门禁红，但局部测绿”作为默认收尾状态
3. 再新增一批超长 plan 文档，而不先给文档系统减重
4. 继续只追 editor 细节，而不先收口状态真值和 editor 内核

## 结论

当前项目不是“开发差”，而是已经进入了一个非常典型的 AI 快速推进阶段：

- 功能推进速度明显快于传统人力节奏
- 代码基线已经出现真实可验证切片
- 但状态表达、实现边界和统一门禁还没有跟上

如果现在优先做 `状态真值层 + editor store-centered 重构 + 门禁回绿`，这个项目会从“做得很快”进入“做得快且越来越稳”。如果继续只追 `04` 的可见功能，短期会更热闹，但长期会更像一个不断长大的 editor，而不是一个正在逼近完整交付闭环的平台。
