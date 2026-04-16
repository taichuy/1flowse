---
memory_type: tool
topic: monorepo 中读取 package.json 前先确认 workspace 根目录
summary: 在 monorepo 仓库根直接用 `sed` 读取 `package.json` 可能失败，因为真实的 Node workspace 根可能在子目录；先用 `rg --files -g 'package.json'` 或 `find` 确认后再读取。
keywords:
  - bash
  - sed
  - package.json
  - monorepo
  - workspace-root
  - missing-file
match_when:
  - 需要读取仓库里的 `package.json` 或 `pnpm-workspace.yaml`
  - 不确定 Node workspace 根是否就是仓库根
  - `sed package.json` 报“没有那个文件或目录”
created_at: 2026-04-13 13
updated_at: 2026-04-13 13
last_verified_at: 2026-04-13 13
decision_policy: reference_on_failure
scope:
  - bash
  - sed
  - package.json
  - web/package.json
  - pnpm-workspace.yaml
---

# monorepo 中读取 package.json 前先确认 workspace 根目录

## 时间

`2026-04-13 13`

## 失败现象

执行 `sed -n '1,260p' package.json` 时返回“没有那个文件或目录”。

## 触发条件

在 monorepo 仓库里做项目级 QA 时，主观假定 Node 工程的 workspace 根就在仓库根目录，直接按根路径读取 `package.json`。

## 根因

当前仓库的前端 workspace 根实际在 `web/`，仓库根没有 `package.json`；失败来自对 workspace 根位置的错误假设。

## 解法

先执行 `rg --files -g 'package.json' -g 'pnpm-workspace.yaml' .` 或 `find` 确认真实 workspace 根，再读取对应目录下的配置文件。

## 验证方式

先检索到 `web/package.json` 与 `web/pnpm-workspace.yaml`，再读取这两个文件均成功。

## 复现记录

- `2026-04-13 13`：在仓库根误读 `package.json` 失败，随后通过 `rg --files` 确认前端 workspace 根在 `web/`，验证恢复正常。
- `2026-04-13 14`：为前端浏览器回归方案补查依赖时，再次把 `package.json` 和 `pnpm-lock.yaml` 主观写成仓库根路径，命令直接报不存在；改为限定读取 `web/package.json` 与 `web/pnpm-lock.yaml` 后恢复正常。
- `2026-04-16 10`：为 `agent-flow` 重构计划核对前端依赖时，在仓库根把 `package.json`、`pnpm-lock.yaml` 混进 `rg` 路径参数，命令返回 `No such file or directory`；改为只读取 `web/app/package.json` 并先用 `rg --files -g 'package.json' -g 'pnpm-lock.yaml' web` 确认真实路径后恢复正常。
