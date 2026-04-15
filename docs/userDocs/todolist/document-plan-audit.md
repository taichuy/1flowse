# 文档计划审计待讨论

更新时间：`2026-04-16 05:09 CST`

说明：本轮只保留新的讨论点，不重复上一轮已经确认的五个问题。重点看三件事：统一门禁是否可信、计划/模块状态是否还能当真值、主包性能债是否已经影响下一阶段策略。

## 1. 现状

- 最近 `24` 小时有 `43` 次提交，真实主线仍是：
  - `工作台 -> Application -> orchestration -> agentFlow editor`
- 当前实现不是“准备做 `03/04`”，而是：
  - `03` 应用宿主已经可运行
  - `04` 第一版 editor 已经可运行
- 本轮验证结果很关键：
  - `pnpm --dir web lint` 通过，但 `node-registry.tsx` 有 `4` 条 warning
  - `pnpm --dir web test` 通过，`89` 个测试
  - `pnpm --dir web/app build` 通过，但主包已经到 `5.19 MB`
  - `cargo test -p control-plane flow_service_tests -v` 通过
  - `cargo test -p api-server application_orchestration_routes -v` 通过
  - `cargo test -p storage-pg flow_repository_tests -v` 通过
  - `node scripts/node/verify-backend.js` 失败，直接卡在 `rustfmt --check`
- 当前新增确认的问题有三个：
  1. 统一门禁已经不再等于真实健康，前后端定向测试能过，但统一后端验证脚本是红的
  2. `modules/README`、`03 README` 和 `agentflow` plan 开始明显落后于代码现实
  3. 主包从之前的“偏大”升级成现在的 `5.19 MB`，性能债已经影响下一步怎么开发

## 2. 可能方向

### 方向 A：继续加速 `03/04`

- 继续堆 editor 能力，把当前 authoring 动量吃满

### 方向 B：先收口真值与门禁

- 先把统一验证、计划状态、模块状态和阶段口径同步回来

### 方向 C：先收口性能与装载面

- 优先做 lazy load、拆包，减少 editor 对全站路由的默认负担

### 方向 D：再补最小 `05/06B` 证明

- 在 authoring baseline 上补 API Key、Run List、publish-gateway 边界

## 3. 不同方向的风险和收益

### 方向 A：继续加速 `03/04`

- 收益：最容易继续看到“新功能”
- 风险：主包继续变大，计划和模块状态会更失真，统一门禁红灯会越来越碍事

### 方向 B：先收口真值与门禁

- 收益：后续 AI 协作和计划管理会重新稳定
- 风险：短期看起来不像在“加新能力”

### 方向 C：先收口性能与装载面

- 收益：现在拆包，成本远低于 `05/06B` 之后再回头
- 风险：会碰路由和构建边界，不是零成本

### 方向 D：再补最小 `05/06B` 证明

- 收益：最快重新证明 `publish-first` 方向没跑偏
- 风险：如果先不做 B/C，会把旧问题带进新模块

## 4. 对此你建议是什么？

建议顺序改成：`先 B，再 C，再 D，最后回到 A`。

### 先做的事

1. 让 `node scripts/node/verify-backend.js` 回到可绿状态
2. 同步更新：
   - `docs/superpowers/specs/1flowse/modules/README.md`
   - `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
   - `docs/superpowers/plans/2026-04-15-agentflow-editor.md`
3. 从 `web/app/src/app/router.tsx` 开始做路由级 lazy load，先把应用详情、编排页、设置页、子系统页、工具页拆出主入口

### 再做的事

1. 正式把当前阶段改口径为：
   - `Application-hosted agentFlow authoring baseline 已落地`
   - `下一步补 05/06B 最小产品证明`
2. 再补应用级 API Key、最小 Run List 和 `publish-gateway` 接口边界

### 当前不建议优先做的事

1. 继续只追 editor 功能，不处理 `5.19 MB` 主包
2. 继续让计划文档和模块状态落后于代码现实
3. 继续把“统一门禁红灯”当成无关紧要的小格式问题
