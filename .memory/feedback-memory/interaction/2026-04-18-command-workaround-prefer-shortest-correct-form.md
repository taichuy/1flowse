---
memory_type: feedback
feedback_category: interaction
topic: 给命令避坑建议时优先写最短正确命令，避免模型回到高频错误路径
summary: 当需要给出命令替代方案来绕开已知工具坑时，优先写当前目录下最短可执行的正确命令，而不是一上来写更长的 `--dir` 或 package script 变体。更短的正确形式更容易把后续模型从高频错误路径拉开。
keywords:
  - interaction
  - command
  - pnpm
  - workaround
  - shortest
  - model guidance
match_when:
  - 用户在纠正命令推荐写法
  - 需要记录某个工具坑的替代命令
  - 需要写给后续模型复用的避坑指令
created_at: 2026-04-18 00
updated_at: 2026-04-18 00
last_verified_at: 2026-04-18 00
decision_policy: direct_reference
scope:
  - interaction
  - tool guidance
  - pnpm
  - vitest
---

# 给命令避坑建议时优先写最短正确命令，避免模型回到高频错误路径

## 时间

`2026-04-18 00`

## 规则

当需要给出命令替代方案来绕开已知工具坑时，优先写当前目录下最短可执行的正确命令。例如已经在 `web/app` 时，优先写 `pnpm exec vitest run <file>`，不要默认展开成更长的 `pnpm --dir web/app ...` 或重新回到 package script。

## 原因

很多模型的第一选择会回到高频模式，例如 `pnpm --dir web test -- --run ...`。如果替代建议仍然写得很像原错误路径，后续更容易再次滑回去。直接给最短正确形式，更利于形成稳定默认动作。

## 适用场景

- 编写工具记忆里的解法
- 给后续模型补充命令避坑建议
- 当前仓库里需要在 `pnpm run <script>` 和 `pnpm exec <tool>` 之间做明确选择

## 备注

若当前不在目标包目录，再补 `--dir`；但默认推荐文案仍应先写最短正确版本。
