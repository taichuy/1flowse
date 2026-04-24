---
memory_type: feedback
feedback_category: repository
topic: 本地文件默认根目录应固定到 api/storage
summary: 讨论业务文件本地存储设计时，用户明确要求默认本地文件上传根目录固定为 `api/storage`，不要再使用仓库根 `storage/uploads` 之类的泛路径。
keywords:
  - local-storage
  - api/storage
  - file-manager
  - object-storage
  - default-path
match_when:
  - 设计或实现业务文件本地存储
  - 编写文件管理或对象存储 spec
  - 决定本地文件默认上传目录
created_at: 2026-04-23 20
updated_at: 2026-04-23 20
last_verified_at: 2026-04-23 20
decision_policy: direct_reference
scope:
  - api/crates/storage-object
  - api/apps/api-server
  - docs/superpowers/specs
---

# 本地文件默认根目录应固定到 api/storage

## 时间

`2026-04-23 20`

## 规则

- 业务文件体系的本地存储器默认根目录固定为 `api/storage`。
- 设计文档、默认配置和实现时，都不要再把默认目录写成仓库根下的 `storage/uploads` 或其他泛路径。
- `api/storage` 作为业务文件目录，与 `api/plugins` 插件产物目录严格分离。

## 原因

- 用户希望本地业务文件路径直接落在 `api/` 边界内，和后端宿主一起管理。
- 这样比仓库根泛目录更清晰，也更容易与插件产物目录做职责隔离。

## 适用场景

- 设计业务文件管理与对象存储架构
- 设置本地存储器默认值
- 实现文件上传、预览和下载链路
