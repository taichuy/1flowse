---
memory_type: tool
topic: git commit --only 不能直接提交未跟踪新文件
summary: 当使用 `git commit --only -- <paths>` 只提交指定路径时，如果路径里包含未跟踪新文件，Git 会报“未匹配任何 git 已知文件”；已验证的做法是先对新文件执行 `git add`，再按路径范围提交。
keywords:
  - git
  - commit
  - only
  - untracked
  - pathspec
match_when:
  - 使用 `git commit --only`
  - 计划只提交指定路径
  - 指定路径中包含新建未跟踪文件
created_at: 2026-04-13 15
updated_at: 2026-04-13 15
last_verified_at: 2026-04-13 15
decision_policy: reference_on_failure
scope:
  - git
  - repository
---

# git commit --only 不能直接提交未跟踪新文件

## 时间

`2026-04-13 15`

## 失败现象

执行：

```bash
git commit --only -m "..." -- <tracked-path> <new-untracked-path>
```

时，Git 报：

```text
error: 路径规格 '<new-untracked-path>' 未匹配任何 git 已知文件
```

## 触发条件

- 使用 `git commit --only` 或按路径范围提交；
- 指定路径里含有尚未 `git add` 的新文件。

## 根因

`git commit --only` 只能从 Git 已知路径集中挑选内容；未跟踪文件尚未进入索引，路径规格无法被识别。

## 解法

- 先对新文件执行 `git add <new-untracked-path>`；
- 再执行按路径范围的 `git commit -m "..." -- <paths>`。

## 验证方式

- `git add .memory/project-memory/...`
- `git commit -m "..." -- <tracked-paths> <newly-added-path>`

已验证可只提交目标文件，不会把仓库里其他无关暂存内容一并带入。

## 复现记录

- `2026-04-13 15`：执行 `git commit --only -m "test: verify backend qa session auth closure" -- ... .memory/project-memory/2026-04-13-backend-qa-session-auth-closure-implemented.md` 时失败；先 `git add` 新文件后改用按路径提交成功。
