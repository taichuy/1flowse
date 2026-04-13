# 1Flowse Demo Iteration

时间：`2026-04-14 04`

## 本轮先批判什么

1. `流程编排` 仍被藏在首页 CTA 后面，和 1Flowse “Flow 是核心资产、发布是核心交付物”的产品现状不一致。
2. Studio 页面只有“节点 + inspector”，没有把 `Flow / Publish / Runtime / State` 四条主线讲清楚，用户只能看见画布，不知道它为什么重要。
3. Demo 虽然页面变多了，但首包仍在把多页逻辑一起带进首页，工程层没有把“演示项目”当成真实产品壳层处理。
4. 移动端之前重点解决了壳层压缩，但 Studio 在 richer content 下是否还能维持可读，需要重新做真实浏览器检查。

## 这轮判断

- 这次最主要的问题是**设计与信息架构漂移**，不是单纯样式问题。
- `frontend-development` 这类实现约束能保证边界不乱，但对“1Flowse demo 必须优先体现核心产品主线”提醒得还不够直接。
- 所以本轮先修产品主线表达，再顺手把路由拆包补上；否则 demo 会继续像“漂亮的控制台页”，不像当前项目本身。

## 本轮怎么改

### 产品主线修正

| 区域 | 改前问题 | 本轮修正 |
| --- | --- | --- |
| 顶部导航 | `流程编排` 不是一级入口 | 提升为一级导航，和工作台、子系统、工具、设置并列 |
| Studio 主体 | 只看见节点列表，产品主线不清 | 改成 `执行链路 + 发布检查 + 运行轨道 + 状态记忆 + 关联入口` |
| Inspector | 只是节点详情卡 | 明确为可访问 region，点击节点后稳定更新聚焦信息 |
| 首包策略 | 多页逻辑被首页一起吃掉 | 路由改成懒加载，并按 `react / tanstack / antd` 做 vendor chunk 拆分 |

### 已落地改动

- `tmp/demo/app/src/app/router.tsx`
  - 一级导航新增 `流程编排`
  - 各页面改成 `lazy + Suspense` 路由组件
  - 增加轻量页面加载态
- `tmp/demo/app/src/features/agent-flow/AgentFlowPage.tsx`
  - 编排页重做为主产品舞台
  - 新增 `当前交付物 / 执行链路 / 运行轨道 / 发布检查 / 状态记忆 / 关联入口`
- `tmp/demo/app/src/features/demo-data.ts`
  - 增加 Studio 所需的发布、运行时、状态层 mock 数据
- `tmp/demo/app/vite.config.ts`
  - 增加 `manualChunks`
- `tmp/demo/app/src/styles/global.css`
  - 补齐新编排页、运行轨道、加载态样式
- `tmp/demo/app/src/app/_tests/*.test.tsx`
  - 回归测试覆盖新导航、Studio 主线结构和懒加载下的稳定查询

## 本轮验证

### 命令验证

- `pnpm --dir tmp/demo lint`
- `pnpm --dir tmp/demo test`
- `pnpm --dir tmp/demo build`

结果：

- lint：通过
- test：通过，`9 passed`
- build：通过

构建结果关键点：

- 首页入口脚本降到 `dist/assets/index-BhZg3OCp.js 8.32 kB`
- 页面 chunk 已拆出：
  - `HomePage-C--v-5xS.js 4.77 kB`
  - `AgentFlowPage-CcJNfVER.js 4.67 kB`
  - `ToolsPage-V4Te_r84.js 5.12 kB`
  - `EmbeddedAppsPage-C6upaRYC.js 3.07 kB`
  - `SettingsPage-BqortUPR.js 2.17 kB`
- vendor 仍较大：
  - `antd-vendor-Dd57EqJC.js 799.69 kB`

### 浏览器验收

服务器：

- `pnpm --dir tmp/demo/app exec vite --host 127.0.0.1 --port 3200`

本轮页面检查：

- 桌面端 `http://127.0.0.1:3200/`
  - 顶栏已出现 `工作台 / 流程编排 / 子系统 / 工具 / 设置`
  - 首页仍维持 `行动队列 / 常用入口 / 最近运行 / 治理提醒`
- 桌面端 `http://127.0.0.1:3200/studio`
  - 可见 `执行链路 / 运行轨道 / 发布检查 / 状态记忆`
  - 符合“Flow 发布前治理闭环”表达
- 移动端 `http://127.0.0.1:3200/studio`
  - 顶栏仍压缩为 `1Flowse + 打开导航菜单`
  - 点击 `发布网关` 后，`当前聚焦节点` 已切换为 `发布网关 / 平台运行时 / 已就绪`

本轮浏览器检查使用了 Chrome DevTools 页面快照，没有额外生成图片证据。

## 本轮失败与环境坑

1. 直接在沙箱里启动 `vite` 监听 `127.0.0.1:3200` 仍然报：
   - `listen EPERM: operation not permitted 127.0.0.1:3200`
   - 这不是代码错误，是当前环境端口权限限制
   - 处理方式：提权后再启动
2. Chrome DevTools 在打开页面前再次命中遗留 `chrome-profile`：
   - `browser is already running for chrome-profile`
   - 处理方式：先 `ps -ef` 定位，再只清理遗留 profile 的 Chrome 进程，不做宽匹配 `pkill`

## 下一轮优先级

1. `antd-vendor` 仍然接近 `800 kB`，下一轮要继续判断是否拆 `icons / table / menu` 或减少重组件覆盖面。
2. Studio 移动端虽然逻辑通了，但信息密度偏高；下一轮可以考虑把 `当前交付物` 和顶部指标压成一个可折叠区块。
3. 首页现在有了 `流程编排` 一级入口，但 `治理提醒` 仍偏静态；下一轮可以让它和当前主 Flow 产生更直接的联动。
4. `tmp/demo/packages/*` 仍是沙盒副本，不是直接复用 `web/packages/*`，工程同步漂移风险还在。
