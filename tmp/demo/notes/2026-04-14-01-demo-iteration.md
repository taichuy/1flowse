# 1Flowse Demo Iteration

时间：`2026-04-14 01`

## 本轮目标

- 把 `tmp/mock-ui` 的组件预览骨架恢复成 `tmp/demo`
- 让 demo 对齐当前 1Flowse 控制台现状，而不是继续停留在 `bootstrap / theme preview`
- 用 mock 数据把工作台、Studio、子系统、工具、设置五类主要交互跑通

## 本轮已完成

- 路由改成：
  - `/` 工作台
  - `/studio` Agent Flow Studio
  - `/subsystems` 子系统
  - `/tools` 工具
  - `/settings` 设置
- 顶部导航改成稳定的 L2 入口：`工作台 / 子系统 / 工具 / 设置`
- 工作台加入：
  - 当前收敛主线
  - 最近运行 drawer
  - 当前项目现状
  - 本轮批判
- Studio 加入固定 `canvas-like surface + inspector`
- 工具页把 `API / 调用日志 / 监控报表` 收口到同一页面的 tabs
- 设置页加入 `个人资料 / 团队 / 访问控制 / API 文档`
- `vite` 端口改到 `3200`
- 清理了旧的 `Theme Preview`、`EmbeddedMount`、`EmbeddedAppDetail` 占位文件
- 清掉了 demo 本地 `@1flowse/ui` 里残留的 `Mock workspace` 文案

## 本轮批判

1. `tmp/demo/packages/*` 目前是从旧沙盒复制来的副本，不是直接复用 `web/packages/*` 真正最新实现。
结果：
- 这次已经暴露出 `@1flowse/ui` 仍残留 `Mock workspace` 的旧语义。
- 后续如果 `web/packages` 再变，demo 还会继续漂移。
建议：
- 下一轮优先决定是继续在 `tmp/demo` 里维护副本，还是把 alias / workspace 直接切到 `web/packages`。

2. 移动端壳层虽然可用，但顶部仍是完整展开导航。
结果：
- 390px 下首屏信息仍然偏满，虽然主内容已在导航后直接出现，但没有形成真正紧凑的“移动端控制台”。
建议：
- 下一轮考虑把移动端一级导航折叠成 `segment / sheet / collapse` 之一。

3. 工具页目前只解决了页面边界，没有解决深层筛选体验。
结果：
- `API / 调用日志 / 监控报表` 主题已经不再抢一级入口，但仍缺少搜索、筛选、空态、错误态这些管理层语法。
建议：
- 下一轮优先补调用日志的筛选栏和监控报表的异常 drill-down。

4. 构建产物主 chunk 仍偏大。
结果：
- `vite build` 输出主 JS `1,380.71 kB`，已经触发 chunk warning。
建议：
- 如果 demo 继续变大，下一轮要引入按页拆分或手动分 chunk。

## 已验证

- `pnpm --dir tmp/demo/app lint`
- `pnpm --dir tmp/demo/app test`
- `pnpm --dir tmp/demo/app build`
- 浏览器检查：
  - 桌面端工作台首页可打开，导航和主入口正确
  - 移动端 Studio 可打开，点击 `发布网关` 后 inspector 会更新

## 下一轮入口

- 先看本文件，再决定是否做：
  - `packages` 同步策略
  - 移动端导航压缩
  - 工具页更深一层的管理交互
  - Studio 移动端层级继续收紧

---

## 追加迭代：`2026-04-14 01`

### 这轮为什么继续改

本轮不是再扩页面数量，而是针对真实截图暴露出来的三类问题继续收口：

1. 壳层动作区在桌面和移动端都出现右侧裁切，页面一打开就暴露“未完成”的质感问题。
2. 首页和工具页仍带着明显的内部评审语气，例如 `CURRENT PRODUCT DEMO`、`Agent Flow Studio`、`本轮批判`。
3. 子系统和工具页虽然已有内容，但缺少真正的 L1 详情动作，像展示板，不像控制台。

### 本轮新增完成

- 把 `@1flowse/ui` 的主题常量拆到 `packages/ui/src/theme.ts`，去掉了原先的 fast-refresh lint warning。
- 工作台首页改成更高密度的控制台概览：
  - 顶部直接给 `进入流程编排 / 查看子系统接入 / 查看工具台`
  - 右侧补 `当前工作区` 摘要卡
  - 把 `本轮批判` 改成产品语义的 `治理提醒`
- 子系统页补了详情抽屉，点击表格中的系统名称即可查看挂载方式、访问上下文和待办事项。
- 工具页改成 “指标摘要 + 待处理事项 + 接口概览 + 收口方向”，不再只是一个空 hero 加大表格。
- 设置页把 `团队` 占位替换为 `安全设置`，结构改成 `账户资料 / 安全设置 / 访问控制 / API 文档`。
- `Agent Flow Studio` 全部对外收口成 `流程编排`，减少内部术语泄漏。
- 顶部健康标签和账户入口已经不再在桌面端溢出，移动端也不再裁切。

### 这轮验证

- `pnpm --dir tmp/demo lint`
- `pnpm --dir tmp/demo test`
- `pnpm --dir tmp/demo build`
- 截图证据：
  - `notes/screenshots/home-desktop-after.png`
  - `notes/screenshots/home-mobile-after.png`
  - `notes/screenshots/tools-desktop-after.png`

### 这轮后的残余问题

1. 移动端壳层虽然不再裁切，但首屏依旧先看到导航 + 健康 + 账户，再进入 hero；下一轮可以把健康状态并入账户带或下沉进页面内容。
2. 工具页右侧仍然是 API 表格主导，后续要决定它到底是“事件处理中枢”还是“接口审阅中枢”，避免两个中心同时抢视觉主位。
3. 工作台下半区里 `待处理事项` 和 `最近运行` 仍有数据重叠，后续应继续拆清“行动队列”和“历史运行”。
