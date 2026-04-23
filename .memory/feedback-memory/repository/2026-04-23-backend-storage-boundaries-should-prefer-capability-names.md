---
memory_type: feedback
feedback_category: repository
topic: 后端存储边界命名应优先能力名而不是实现后缀
summary: 用户不喜欢 `storage-pg` 这类直接绑定实现后缀的目录命名；当边界语义是能力层而不是单一实现时，应优先用能力名，并同步更新 AGENTS 与相关 skill。
keywords:
  - storage-pg
  - storage
  - naming
  - backend
  - capability-boundary
match_when:
  - 设计或重命名后端存储 crate
  - 讨论存储边界命名
  - 需要决定目录名是否绑定具体实现
created_at: 2026-04-23 15
updated_at: 2026-04-23 15
last_verified_at: 2026-04-23 15
decision_policy: direct_reference
scope:
  - api/crates
  - api/AGENTS.md
  - .agents/skills
---

# 后端存储边界命名应优先能力名而不是实现后缀

## 时间

`2026-04-23 15`

## 规则

- 当 crate 表达的是架构能力边界，而不是单一实现细节时，目录名优先使用能力名。
- 对 `storage-pg` 这类直接暴露实现后缀的命名，用户默认不偏好。
- 如果发生这类重命名，需要同步更新 `api/AGENTS.md` 和相关 skill / references，不能只改代码目录。

## 原因

- 直接绑定实现后缀会把架构边界和当前适配器混在一起。
- 用户更偏好 capability-oriented 的命名面，避免后续继续出现 `storage-redis` 这类语义漂移。

## 适用场景

- 新增或重命名后端存储 crate
- 调整 repository / adapter 边界
- 同步维护后端规则文档与 skill 引用
