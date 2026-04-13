---
memory_type: tool
topic: 检索 monorepo 依赖类型前先确认真实 node_modules 所在 workspace
summary: 在本仓库里直接把依赖路径写成 `web/node_modules/...` 或 `web/app/node_modules/rc-menu/...` 可能报 `No such file or directory`，因为实际安装位置受 workspace 边界和 pnpm 链接结构影响；先确认具体 package 根目录，再按真实路径检索更稳。
keywords:
  - rg
  - node_modules
  - workspace
  - pnpm
  - no such file or directory
match_when:
  - 需要在 monorepo 中查看某个前端依赖的类型定义
  - 直接检索 `node_modules` 路径时报不存在
  - 不确定依赖装在 workspace 根还是子 package
created_at: 2026-04-13 11
updated_at: 2026-04-13 11
last_verified_at: 2026-04-13 11
decision_policy: reference_on_failure
scope:
  - rg
  - web
  - web/app
  - node_modules
---

# 检索 monorepo 依赖类型前先确认真实 node_modules 所在 workspace

## 时间

`2026-04-13 11`

## 失败现象

执行依赖类型检索时，先后出现：

- `web/node_modules/antd: No such file or directory (os error 2)`
- `web/app/node_modules/rc-menu: No such file or directory (os error 2)`

## 触发条件

在 monorepo 中凭经验假设依赖一定安装在 `web/node_modules`，或继续假设 `rc-menu` 会以可见目录形式出现在 `web/app/node_modules`。

## 根因

pnpm workspace 下依赖实际落点会随 package 根目录和符号链接结构变化，直接猜路径容易错。

## 已验证解法

先确认正在查看的是哪个 package，例如 `web/app/package.json` 对应的 `node_modules`，再用 `rg --files web/app/node_modules/antd`、`find web/app/node_modules -maxdepth 2 -name '<package>'` 或直接读取已知入口包的类型文件，避免跨 workspace 盲猜依赖路径。
