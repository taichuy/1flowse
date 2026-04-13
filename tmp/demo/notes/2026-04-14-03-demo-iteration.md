# 1Flowse Demo Iteration

时间：`2026-04-14 03`

## 本轮先批判什么

1. `tools` 页虽然已经收口成事件处理中枢，但 L0 表格和 L1 抽屉之间缺少明确的 L2 出口，用户知道问题是什么，却还得自己判断该去哪个页处理。
2. `subsystems` 页仍然以桌面表格为中心，移动端只有“缩小后的管理表”，没有真正适配手机场景的卡片层。
3. Demo 里仍有一批英文实体名直接暴露在主视觉层，例如 `Growth Portal`、`Platform Ops`、`Security`，导致产品感不完整。

## 本轮怎么改

### 信息架构修正

| 区域 | 改前问题 | 本轮修正 |
| --- | --- | --- |
| 工具页 | 事件详情抽屉没有明确处理出口 | 每条事件补 `actionHref + actionLabel`，L1 抽屉底部固定出现去往 L2 管理页的 CTA |
| 工具页移动端 | 仍以压缩表格为主 | 新增 `事件卡片列表`，移动端只保留筛选 + 搜索 + 卡片，桌面继续看表格 |
| 子系统页移动端 | 只有表格，没有卡片层 | 新增 `子系统卡片列表`，点击卡片统一进入详情抽屉 |
| 对外语义 | 英文实体名和内部 scope/code 泄露 | 把主标题、负责人、挂载方式、权限矩阵、暴露级别等主视觉信息统一改成中文产品语义 |

### 已落地改动

- `tmp/demo/app/src/features/demo-data.ts`
  - 把 `Growth Portal / Platform Ops / Security / Developer Experience` 等主显示语义改成中文。
  - 为 `toolIncidents` 和 `subsystems` 增加 `actionLabel / actionHref`。
  - 把 `accessMatrix.scope / permissions`、`apiSurface.exposure` 等设置页信息改成中文产品表达。
- `tmp/demo/app/src/features/tools/ToolsPage.tsx`
  - 搜索提示扩展到 `事件、负责人、治理域`。
  - 桌面端表格保留；移动端新增 `事件卡片列表`。
  - 事件抽屉底部增加明确去向，例如 `前往访问控制 / 查看发布检查 / 打开子系统页`。
- `tmp/demo/app/src/features/embedded-apps/EmbeddedAppsPage.tsx`
  - 桌面端保留表格；移动端新增 `子系统卡片列表`。
  - 子系统抽屉底部增加 `进入接入治理 / 查看同步事件 / 查看 API 文档`。
- `tmp/demo/app/src/app/router.tsx`
  - 顶栏团队显示名从 `Growth Lab` 收口为 `增长实验室`。
- `tmp/demo/app/src/styles/global.css`
  - 新增 `incident-card-region / subsystem-card-region` 及移动端卡片样式。
  - 在 `< 960px` 下切换为 `卡片 visible / 桌面表格 hidden`。

## 本轮验证

### 命令验证

- `pnpm --dir tmp/demo/app test -- --runInBand src/app/_tests/app-demo.test.tsx src/app/_tests/demo-ux-regression.test.tsx`
- `pnpm --dir tmp/demo lint`
- `pnpm --dir tmp/demo test`
- `pnpm --dir tmp/demo build`

结果：

- 定向回归测试：`9 passed`
- workspace lint：通过
- workspace test：通过
- workspace build：通过
- 当前主包：`dist/assets/index-XbWPsTF9.js 1,150.87 kB`
  - 仍有 chunk warning，说明首包治理还没完成

### 浏览器验收

服务器：

- `pnpm --dir tmp/demo/app exec vite --host 127.0.0.1 --port 3200`

页面检查：

- 桌面端 `http://127.0.0.1:3200/`
  - 顶栏保留 `平台健康 + 增长实验室`
  - 工作台行动队列与最近运行继续分层，没有回退
- 桌面端 `http://127.0.0.1:3200/tools`
  - 事件表格保留，负责人和治理域已改成中文
  - `权限矩阵冲突` 抽屉里出现 `前往访问控制`
- 移动端 `http://127.0.0.1:3200/tools`
  - 顶栏只剩 `1Flowse + 打开导航菜单`
  - `事件卡片列表` 已出现，不再依赖压缩表格
- 移动端 `http://127.0.0.1:3200/subsystems`
  - `子系统卡片列表` 已出现
  - `增长门户` 抽屉里出现 `进入接入治理`

本轮浏览器检查使用了 Chrome DevTools 页面快照，没有额外生成图片证据。

## 本轮失败与环境坑

1. Chrome DevTools MCP 一度因为遗留浏览器实例报 “browser is already running for chrome-profile”，导致 `new_page` 失败。
2. 直接用宽匹配执行 `pkill -f 'chrome-devtools-mcp'` 会让当前 shell 自己异常退出，不能作为默认清理方式。
3. 最后通过先 `ps -ef` 定位，再只清理遗留 browser/profile 进程，恢复了浏览器验收链路。

## 下一轮优先级

1. 首包仍然在 `1.15 MB` 左右，下一轮优先做路由级拆包，至少把 `studio / tools / subsystems` 从首页首包拆开。
2. 工具页移动端虽然已经切到事件卡片，但 `接口面摘要` 仍然完整铺开；下一轮应判断它是否要折叠成二级区块。
3. `tmp/demo/packages/*` 仍是副本，不是直接复用 `web/packages/*`，后续仍有同步漂移风险。
