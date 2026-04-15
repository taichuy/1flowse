# 文档计划审计待讨论

更新时间：`2026-04-16 06:03 CST`

说明：本轮只保留新的讨论重点，不重复前两轮已经讲清的旧问题。重点从“顶层真值、收尾定义、产品阶段、装载边界”四个角度看。

## 1. 现状

- 最近 `24` 小时共有 `44` 次提交，真实主线还是：
  - `Application 宿主 -> orchestration -> agentFlow editor`
- 当前真实开发状态：
  - `03` 已经是可运行基线
  - `04` 已经是可运行基线
  - `05/06B` 还没有最小产品闭环
- 本轮验证结果：
  - `pnpm --dir web lint` 通过，但 `node-registry.tsx` 还有 `4` 条 warning
  - `pnpm --dir web test` 通过，`30` 个测试文件、`89` 个测试
  - `pnpm --dir web/app build` 通过，但主包还是 `5.19 MB`
  - `node scripts/node/verify-backend.js` 失败，卡在 `rustfmt --check`
  - 三条定向 Rust 测试都通过
- 本轮新增或升级的问题：
  1. 问题已经不只是模块 README 落后，而是顶层产品文档也失真了
  2. `plan 勾选完成`、`代码已提交`、`最终验证完成` 三件事已经脱钩
  3. 当前真实阶段更像 `authoring baseline`，但主文档仍在同时背 `publish-first` 和 `builder-first`
  4. editor 装载成本还在外溢，主包仍是 `5.19 MB`

## 2. 可能方向

### 方向 A：先收口顶层真值

- 更新产品需求、模块总览、模块 03 文档和 agentflow plan

### 方向 B：先收口统一门禁

- 修 `verify-backend`
- 明确 style-boundary 的正式执行路径

### 方向 C：先收口装载边界

- 做路由级 lazy load
- 切开应用详情和 editor 的同步装载

### 方向 D：先补最小 `05/06B` 证明

- API Key
- Run List
- publish-gateway 真实边界

### 方向 E：继续只追 editor 功能

- 继续扩节点和交互

## 3. 不同方向的风险和收益

### 方向 A：先收口顶层真值

- 收益：后续讨论会重新建立在真实状态上
- 风险：短期看起来不像“在做新功能”

### 方向 B：先收口统一门禁

- 收益：提交完成才能重新等于真正收尾
- 风险：短期投入会落在脚本、格式和执行路径

### 方向 C：先收口装载边界

- 收益：现在拆包，成本远低于后面再回头
- 风险：会碰路由和共享壳层，不是零成本

### 方向 D：先补最小 `05/06B` 证明

- 收益：最快证明项目不是在做纯 editor
- 风险：如果 A/B/C 不先做，会把旧问题带进新模块

### 方向 E：继续只追 editor 功能

- 收益：功能增长最快
- 风险：真值更散、主包更重、方向更容易偏成 editor-first

## 4. 对此你建议是什么？

建议顺序：`先 A+B，一轮一起做；再 C；再 D；最后才回到 E`。

### 我建议先做的事

1. 同步更新：
   - `2026-04-10-product-requirements.md`
   - `docs/superpowers/specs/1flowse/modules/README.md`
   - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
   - `docs/superpowers/plans/2026-04-15-agentflow-editor.md`
2. 让 `node scripts/node/verify-backend.js` 回到可绿状态
3. 从 `web/app/src/app/router.tsx` 开始做路由级 lazy load

### 我建议随后做的事

1. 把当前阶段正式改口径为：
   - `Application-hosted authoring baseline 已落地`
   - `下一步补 publish/runtime 最小闭环证明`
2. 再补：
   - 应用级 API Key
   - 最小 Application Run List
   - publish-gateway 的真实接口边界

### 当前不建议优先做的事

1. 继续只加 editor，不处理顶层真值层
2. 继续让 `plan 已提交` 和 `最终验证已完成` 不是一回事
3. 继续让 `5.19 MB` 主包拖着整个 console 一起增长

## 受限项

- `style-boundary` 本轮没有拿到新的成功结果，因为当前环境启动本地 `vite` 时监听端口触发 `EPERM`
- 当前工作树仍有未提交改动：`web/app/src/features/agent-flow/components/editor/agent-flow-editor.css`
