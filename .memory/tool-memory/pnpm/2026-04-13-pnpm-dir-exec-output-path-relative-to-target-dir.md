---
memory_type: tool
topic: pnpm --dir exec 运行命令时相对输出路径按目标工作区解析
summary: 使用 `pnpm --dir <workspace> exec <cmd>` 时，命令里的相对输出路径会相对 `<workspace>` 解析，而不是当前仓库根；若仍按仓库根查找输出文件，会误判命令失败。
keywords:
  - pnpm
  - --dir
  - exec
  - relative-path
  - output-file
match_when:
  - 使用 `pnpm --dir <workspace> exec` 运行带输出文件参数的命令
  - 命令日志显示已写出文件，但在仓库根按原相对路径找不到
  - 需要给 `playwright screenshot`、导出脚本、构建脚本指定输出文件
created_at: 2026-04-13 15
updated_at: 2026-04-13 15
last_verified_at: 2026-04-13 15
decision_policy: reference_on_failure
scope:
  - pnpm
  - web
  - playwright
---

# pnpm --dir exec 运行命令时相对输出路径按目标工作区解析

## 时间

`2026-04-13 15`

## 失败现象

执行 `pnpm --dir web exec playwright screenshot ... uploads/foo.png` 后，日志显示已成功截图，但在仓库根的 `uploads/foo.png` 找不到文件。

## 为什么做这个操作

需要为前端 QA 抓取真实运行页面截图，作为 UI 质量和响应式判断证据。

## 触发条件

- 从仓库根目录执行 `pnpm --dir <workspace> exec ...`
- 被执行命令本身接收的是相对输出路径
- 后续按仓库根相对路径去读取产物

## 根因

`pnpm --dir web exec ...` 会在 `web` 工作区上下文里执行命令，因此 `uploads/foo.png` 会被解析成 `web/uploads/foo.png`；如果再传入 `web/uploads/foo.png`，最终会落成 `web/web/uploads/foo.png`。

## 解法

- 最稳妥的做法是给输出文件传绝对路径。
- 如果继续使用相对路径，必须按 `--dir` 指向的工作区作为基准解析。
- 执行后应先在目标工作区内确认文件位置，再做后续读取或截图查看。

## 验证方式

- `pnpm --dir web exec playwright screenshot --browser chromium --channel chrome http://127.0.0.1:3100 uploads/frontend-home-desktop.png`
  - 产物实际位于 `web/uploads/frontend-home-desktop.png`
- `pnpm --dir web exec playwright screenshot --browser chromium --channel chrome --device "Pixel 5" http://127.0.0.1:3100 web/uploads/frontend-home-mobile.png`
  - 产物实际位于 `web/web/uploads/frontend-home-mobile.png`

## 复现记录

- `2026-04-13 15`：前端 QA 截图时先按仓库根查找 `uploads/frontend-home-desktop.png` 和 `uploads/frontend-embedded-apps-desktop.png`，误以为截图未落盘；改按 `web/uploads` 与 `web/web/uploads` 查找后确认命令本身成功。
