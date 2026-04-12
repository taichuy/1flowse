## 1Flowse Demo 本轮诊断与计划

时间：2026-04-13 03:13
范围：仅修改 `tmp/demo`
状态：已完成

## 本轮批判

- 移动端顶部任务域切换虽然已经前置，但仍然是横向滚动胶囊，`监控报表` 在首屏被截断，实际可发现性不够。
- 概览页 hero 里的 `Published / Runtime healthy` 在移动端被 grid 拉成整行条带，看起来更像进度条，不像状态标签。
- 概览首屏仍然只有一个“进入编排”动作；如果用户此刻更关心已发布契约或等待态 run，需要继续往下滚，首屏不够像 workspace。

## 本轮修正

1. 把移动端任务域切换改成两列网格并 sticky 到内容顶部，避免首屏切换入口被截断。
2. 收紧 overview hero：
   - 标题改成 `Revenue Copilot` + `Workspace demo` 紧凑标签。
   - 文案压缩成一条状态摘要。
   - 增加 `查看 API 契约` 与 `继续处理等待态` 两个次级跳转，但只保留 `进入编排` 作为唯一主动作。
3. 把 hero 右侧从“拉满宽度的状态条 + 解释文案”改成：
   - 一行紧凑状态标签
   - 三张 signal 卡片：`Published surface / Needs attention / Host context`
4. 同步缩短 `summary stats` 文案，减少卡片高度。

## 当前结果

- 新的移动端首屏已经能同时看到五个任务域入口，不再依赖横向滚动。
- hero 首屏可以直接进入 `编排 / API / 等待态日志` 三个关键下一跳，路径更接近真实 workspace。
- `Published` 与 `Runtime healthy` 恢复成真正的 badge，而不是整条填满容器的假进度条。

## 下一轮入口

- 桌面端 hero 现在仍有一块明显空白，因为右侧 signal 卡片把整个 hero 高度拉起来了，左侧却只有按钮和摘要；下一轮应考虑把这里换成“最近一次 run feed”或“微型画布快照”。
- `summary stats` 仍然偏抽象，后续最好替换成更接近项目现状的 workspace primitive，而不是继续堆数字卡片。
