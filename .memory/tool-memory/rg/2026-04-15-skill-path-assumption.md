---
memory_type: tool
topic: 用 rg 读取 skill 前先按会话里声明的真实路径解析
summary: 当前会话同时存在 repo 本地 skills 与 superpowers 全局 skills；直接把 skill 名按印象拼成 `~/.codex/superpowers/skills/...` 可能报 `No such file or directory`。已验证应先看会话里声明的 skill 文件路径，再把真实路径传给 `rg` 或 `sed`。
keywords:
  - rg
  - skill
  - path
  - no such file or directory
  - agents
match_when:
  - 需要读取某个 skill 的 SKILL.md
  - 会话里同时出现 repo 本地 skill 和全局 superpowers skill
  - rg 输出 skill 路径不存在
created_at: 2026-04-15 17
updated_at: 2026-04-15 17
last_verified_at: 2026-04-15 17
decision_policy: reference_on_failure
scope:
  - rg
  - .agents/skills
  - /home/taichu/.codex/superpowers/skills
---

# 用 rg 读取 skill 前先按会话里声明的真实路径解析

## 时间

`2026-04-15 17`

## 失败现象

- 为了快速定位本次需要用的 skills，执行 `rg --files` 时把 `qa-evaluation` 直接写成 `/home/taichu/.codex/superpowers/skills/qa-evaluation`，命令返回 `No such file or directory`。

## 触发条件

- 会话里同时给了 repo 本地 skills 列表和 superpowers 全局 skills 列表。
- 看到 skill 名后，直接按印象把它归到某个固定 skill 根目录，没有先对照会话里给出的真实文件路径。

## 根因

- `qa-evaluation` 在当前仓库里实际位于 `.agents/skills/qa-evaluation/SKILL.md`，不是 `~/.codex/superpowers/skills/qa-evaluation/SKILL.md`。
- 会话中的 skill 来源是混合的，不能只凭名字判断归属目录。

## 解法

- 先读取当前会话或当前仓库 `AGENTS.md` 里声明的 skill 列表与 file path。
- 如果 skill 来源不确定，先用 `rg --files .agents/skills /home/taichu/.codex/superpowers/skills | rg '(^|/)qa-evaluation/SKILL\\.md$'` 之类的命令确认真实路径。
- 确认后再对真实路径执行 `sed -n`、`rg --files` 或其他读取命令。

## 验证方式

- 改为读取 `.agents/skills/qa-evaluation/SKILL.md` 后成功拿到 QA 流程说明，并继续完成本次任务评估。

## 复现记录

- `2026-04-15 17`：为了先加载 `using-superpowers` 和 `qa-evaluation`，把 `qa-evaluation` 误当成 superpowers 全局 skill 路径传给 `rg --files`，报路径不存在；随后按仓库 `AGENTS.md` 里的 file path 改读 `.agents/skills/qa-evaluation/SKILL.md`，问题解除。
