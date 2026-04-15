# 文档计划审计待讨论

更新时间：`2026-04-16 03`

说明：本文件继续承接 `docs/qa-report/document-plan-audit.md` 的同主题滚动结果。本轮重点不是“03/04 有没有启动”，而是“当前最该先补真值、补门禁，还是继续堆 editor 功能”。

## 本轮新增确认事实

- 最近 `24` 小时 git 有 `41` 次提交，主线明确集中在 `03 Application` 与 `04 agentFlow`
- `03` 计划文件当前真实勾选为 `30`，显式未勾选为 `0`
- `04` 计划文件当前真实勾选为 `33`，显式未勾选为 `1`
  - 唯一明确未闭合项仍是 `style-boundary` 最终场景与收尾验证
- 后端定向行为不是坏的：
  - `cargo test -p api-server application_orchestration_routes -- --nocapture` 通过
  - `cargo test -p control-plane application_service_tests -- --nocapture` 通过
  - `cargo test -p control-plane flow_service_tests -- --nocapture` 通过
- 但统一后端门禁不是绿的：
  - `node scripts/node/verify-backend.js` 当前卡在 `cargo fmt --check`
- 前端关键区域直接测试通过：
  - `application-shell-routing`
  - `agent-flow-editor-page`
  - `style-boundary registry`
- 但前端真实运行验证仍未闭合：
  - `node scripts/node/check-style-boundary.js page page.application-detail` 失败
  - `tmp/logs/web.log` 可见 `vite` 在 `0.0.0.0:3100` 上多次 `listen EPERM`
- 前端构建通过，但体积已经进入需要主动治理的阶段：
  - JS 主包 `5191.42 kB`
  - gzip 后 `1554.34 kB`
  - CSS 主包 `337.71 kB`
- 当前文档问题已经从“滞后”升级成“状态语义冲突”：
  - 根模块总览仍把 `03` 写成 `已确认待开发`
  - 根模块总览仍把 `04` 写成 `未来设计`
  - `03` 模块 README 还写着“待写 implementation plan”和“当前没有 Application 列表/详情路由”
- 当前权限真值也还是两层：
  - 前端路由 guard 主要还是 `route_page.view.all`
  - 后端应用资源真值已经是 `application.view.all / own`
- 当前真正可证明的产品能力仍然是：
  - `工作台 -> Application -> agentFlow`
- 当前还不能算真实能力的仍然是：
  - `API / 日志 / 监控 / 发布`

## 当前最值得拍板的问题

1. 下一轮是继续加深 editor，还是转向最小 `publish / run / logs` 证明？
   - 建议：转向最小 `publish / run / logs` 证明
2. 是否先把 `docs/superpowers` 的模块状态和状态语义统一到代码真相？
   - 建议：是
3. 是否把 `verify-backend` 恢复为当前阶段的硬门禁，而不是接受“局部测试绿、统一脚本红”？
   - 建议：是
4. 是否把 `route_page.view.all` 与 `application.view.*` 做一次明确对齐？
   - 建议：是
5. 是否在继续往 `agentFlow` 加节点前，先做一次目录收纳与分包？
   - 建议：是
6. 是否降低 `工具` 在当前一级心智里的权重，避免继续稀释主线？
   - 建议：是

## 如果按建议推进，下一批最值得做的内容

- 同步 `docs/superpowers/specs/1flowse/modules/README.md`
- 同步 `docs/superpowers/specs/1flowse/modules/03-workspace-and-application/README.md`
- 明确 `04-chatflow-studio/README.md` 的状态语义：
  - 设计完成
  - 还是实现基线
- 处理后端 `cargo fmt --check` 红灯，恢复 `verify-backend.js`
- 明确 `style-boundary` 的正式执行路径，收掉 `04` 计划最后一个未勾选项
- 对 `agentFlow` 做一次收纳：
  - 拆 `node-registry`
  - 拆部分 `node-definitions`
  - 开始做 editor 重依赖 lazy load / chunk split
- 把 `api` 分区先做成真实入口：
  - 应用级 API Key
  - 固定调用路径模板说明
  - 真实契约只读页
- 把 `logs` 分区先做成最小真实对象入口：
  - `Application Run List`
  - 或最小查询契约

## 当前不建议优先做的内容

- 继续只强化 editor 外观、更多节点和更多面板，而不补发布和运行证明
- 在模块 README 仍明显过期时，继续拿它作为当前阶段唯一真相
- 接受“局部测试绿、统一门禁红”的长期状态
- 在包体和目录压力已经出现时，继续把 `agentFlow` 功能横向摊平
- 让 `工具` 继续以一级主入口强化存在感

## 本轮结论摘要

- 当前速度依然快，而且这次不是虚快，是真正做出了可运行主路径。
- 当前最大问题已经不是“主线没启动”，而是：
  - 文档真值不统一
  - 统一门禁不全绿
  - 产品证明落后于 editor 推进速度
- 下一步最应该做的不是继续堆 editor，而是先补真值、补门禁，再把最小 `publish / run / logs` 证明拉起来。

## 2026-04-16 03 本轮新增待拍板

### 新增确认事实

- 当前不是单纯“文档落后”，而是需求基线和代码主线已经出现范围漂移：
  - `product-requirements` 仍要求 `应用概览 / 路由管理 / 页面结构协议 / 动态页面渲染`
  - 当前真实主线已经收缩成 `工作台 -> Application -> agentFlow`
- 用户界面里已经出现研发内部术语泄露：
  - `ApplicationSectionState` 直接写了 `03 / 04 / 05 / 06B`
- 导航、权限和跳转方式目前不是一套真值：
  - 前端 route guard 还是 `route_page.view.all`
  - 后端应用资源真值已经是 `application.view.*`
  - 应用卡片和创建后跳转仍然用整页刷新，不是 router 真值
- `publish-first` 这条产品主线还没有最小证明：
  - `publish-gateway` 现在仍然只是 `crate_name()`
  - `plugin-runner` 目前仍然只有 health + tracing 初始化
  - `api/logs/monitoring` 在应用详情里仍然都是 `planned`
- `agent-flow` 结构压力继续上升：
  - feature 共 `31` 个文件
  - `components` 正好 `15` 个文件
  - `node-definitions.tsx` `485` 行
  - `AgentFlowCanvas.tsx` `404` 行
  - `NodeInspector.tsx` `392` 行
  - `agent-flow-editor.css` `354` 行
- 本轮新鲜验证结果：
  - `pnpm --dir web lint` 通过，但 `node-registry.tsx` 仍有 `4` 条 warning
  - 前端三组关键测试 `18` 个用例通过，但 React Flow warning 还在
  - `pnpm --dir web/app build` 通过，但主包仍是 `5191.42 kB`
  - `node scripts/node/verify-backend.js` 仍卡在 `cargo fmt --check`
  - `style-boundary` 真实运行仍因 `vite listen EPERM 0.0.0.0:3100` 失败

### 这轮最值得明确拍板的问题

1. 是否正式把当前阶段口径改成 `Application-hosted agentFlow authoring baseline`，而不再沿用“P1 广口径平台已在推进中”的表述？
   - 建议：是
2. 是否把需求文档里当前阶段并未兑现的 `概览 / 路由管理 / 页面协议 / 动态页面 / 发布调用` 从当前阶段主线中拆开？
   - 建议：是
3. 是否立即清掉用户界面里的内部编号和研发术语？
   - 建议：是
4. 是否把应用列表和创建后的跳转改成 router 真值，而不是继续使用整页刷新？
   - 建议：是
5. 是否在继续扩 editor 前，先给 `publish-gateway / plugin-runner / api/logs/monitoring` 至少补出一条最小真实链路？
   - 建议：是
6. 是否把 `工具`、`子系统` 的一级暴露度再降一级，避免继续放大“平台很全”的错觉？
   - 建议：是

### 如果按建议推进，下一批最该做的内容

- 重写当前阶段主线口径：
  - 同步 `product-requirements`
  - 同步模块总览
  - 同步 `03/04` 模块 README
- 清理 UI 内部术语：
  - 去掉 `03 / 04 / 05 / 06B`
  - 改成用户可理解的正式能力文案
- 收路由与权限真值：
  - 对齐 `route_page.view.all` 与 `application.view.*`
  - 应用进入路径全部改成 router 跳转
- 恢复门禁：
  - 清掉 `cargo fmt --check`
  - 解决 `style-boundary` 正式运行路径
- 最小补齐产品证明：
  - `api` 分区先落应用级 API Key / 调用契约
  - `logs` 分区先落最小 `Application Run`
  - `publish-gateway` 至少形成真实接口边界
  - `plugin-runner` 至少形成一个可绑定能力槽位
- editor 收纳和降重：
  - 拆 `node-registry`
  - 拆一部分 `node-definitions`
  - 开始 lazy load / chunk split

### 这轮不建议优先做的内容

- 继续优先加更多节点、更多 inspector 字段、更多画布交互
- 继续让产品文档保持“全平台广口径”，但代码主线只做 editor
- 接受 UI 中继续出现内部模块编号
- 接受“局部测试绿、统一门禁红、真实运行回归红”的长期状态
