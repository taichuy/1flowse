# 文档计划审计待讨论

更新时间：`2026-04-16 08:05 CST`

说明：本轮继续沿用同主题，只保留当前时点最值得讨论的新增结论，不重复上一轮已经讲清的旧问题。

## 1. 现状

- 最近 `24` 小时共有 `47` 次提交，触达 `188` 个文件。
- 当前真实开发状态已经变成：
  - `03 Application 宿主基线已落地`
  - `04 agentFlow authoring baseline 已落地`
  - `05/06B` 仍没有最小产品证明
- 本轮新验证结果：
  - `pnpm --dir web lint`：通过，但 `node-registry.tsx` 还有 `4` 条 warning
  - `pnpm --dir web test`：通过，`30` 个测试文件、`89` 个测试
  - `pnpm --dir web/app build`：通过，但主包仍是 `5.19 MB`
  - `node scripts/node/verify-backend.js`：失败，卡在 `rustfmt --check`
  - 三条定向 Rust 测试都通过
  - 浏览器级 `style-boundary` 这轮没有新证据，因此 UI 质量结论仍受限
- 当前工作树比上一轮稳定很多：
  - 只剩 `agent-flow-editor.css` 一个改动文件

### 本轮新增或升级的问题

1. `模块状态字段仍然失真`
   - `modules/README` 还把 `03` 写成待开发、`04` 写成未来设计
   - `03 README` 还写着当前没有 Application 列表/详情/四分区路由
   - `04 README` 却又写成已完成
   - 本质问题不是简单落后，而是“设计完成”和“实现完成”混在一个状态字段里

2. `04 已经可用，但 editor 实现架构还没冻结`
   - 最新又新增了 `store-centered` 重构设计稿
   - 当前 document mutation 仍分散在 `Shell / Canvas / Inspector / node-registry`
   - `node-registry.tsx` 还在用全局事件桥

3. `产品方向没错，但阶段口径还是偏得太像 P1 闭环`
   - PRD 仍围绕 `runtime / publish / 外部调用`
   - 实际开发主线仍集中在 `Application + agentFlow authoring`
   - 当前更像“宿主 + 编辑器基线稳定化”，还不是“P1 闭环快完成”

4. `验证成熟度改善了，但还不是单一可信真相`
   - 前端 lint/test/build 全绿
   - 后端定向测试全绿
   - 后端统一验证仍红
   - UI 运行时门禁证据这轮没补上

5. `文档系统仍然过重`
   - `docs` 类提交 `14` 次
   - 两份主 plan 各改了 `8` 次
   - 两份主 plan 都超过 `2000` 行
   - `plans/history` 和 `specs/history` 目录都超过 `20` 个文件

## 2. 可能方向

### 方向 A：先重建状态真值层

- 拆开：
  - `设计状态`
  - `实现状态`
  - `已验证基线`
  - `下一阶段`

### 方向 B：先完成 `agentFlow` store-centered 重构

- 把 document 写操作从组件里抽到：
  - `editor store`
  - `document transforms`
  - `interaction hooks`

### 方向 C：先把统一门禁拉回可信

- 修 `verify-backend`
- 给 `style-boundary` 一个正式执行路径

### 方向 D：开始补最小 `05/06B` 价值证明

- `Application API Key`
- `Run List / Run Detail`
- `Publish Endpoint` 骨架

### 方向 E：继续只追 editor 功能日更

- 继续补节点、交互和画布细节

## 3. 不同方向的风险和收益

### 方向 A：先重建状态真值层

- 收益：后续讨论进度和优先级会回到同一真相层
- 风险：短期不会新增用户可见能力

### 方向 B：先做 store-centered 重构

- 收益：把 `04` 从“能跑”升级成“能持续扩展”
- 风险：短期会有结构重排成本

### 方向 C：先修统一门禁

- 收益：收尾标准重新清楚，不再靠口头解释
- 风险：短期主要是治理投入

### 方向 D：先补 `05/06B`

- 收益：最快证明项目没有偏成纯 editor
- 风险：如果不先做 A/B/C，会把旧问题带入新模块

### 方向 E：继续只追 editor

- 收益：可见变化最快
- 风险：会继续放大 editor 架构分散、阶段失真和文档维护税

## 4. 对此你建议是什么？

建议顺序：`先 A + B，再 C，再 D，最后才继续 E`

### 我建议现在先做

1. 重写 `modules/README`、`03 README`、`04 README` 和 PRD 的阶段表达
2. 把 `04` 明确改口径为：
   - `功能基线已落地`
   - `实现架构待收口`
3. 直接推进 `store-centered` 重构
4. 让 `verify-backend.js` 回绿
5. 给 UI 运行时门禁一条正式执行路径

### 我建议随后做

1. 补最小 `05/06B` 价值证明：
   - `API Key`
   - `Run List / Run Detail`
   - `Publish Endpoint`
2. 用 AI 时代指标来判断进度：
   - `已验证垂直切片`
   - `门禁可信度`
   - `状态同步延迟`
   - `实现架构波动`

### 当前不建议优先做

1. 继续把 `03/04` 写成待开发或未来设计
2. 继续接受“统一门禁红、局部测试绿”作为默认收尾
3. 再新增超长 plan 文档而不先减重
4. 继续只追 editor 细节，而不先收口状态真值和 editor 内核
