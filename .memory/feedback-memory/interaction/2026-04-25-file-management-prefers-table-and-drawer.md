---
memory_type: feedback
feedback_category: interaction
topic: 后台文件管理页优先表格管理与抽屉表单
summary: 用户明确指出文件管理页不接受卡片墙式展示，更偏好后台管理页使用表格承载列表，头部放新增、刷新、检索，行内放查看、编辑、删除，新增/查看/编辑统一使用抽屉。
keywords:
  - file management
  - table
  - drawer
  - admin ui
  - settings
match_when:
  - 后台管理页出现卡片墙
  - 文件管理、配置管理、资源管理页需要改版
  - 用户要求列表管理与详情编辑并存
created_at: 2026-04-25 08
updated_at: 2026-04-25 08
last_verified_at: 2026-04-25 08
decision_policy: direct_reference
scope:
  - web/app/src/features/settings
  - .memory/feedback-memory/interaction
---

# 后台文件管理页优先表格管理与抽屉表单

## 时间

`2026-04-25 08`

## 规则

- 文件管理这类后台管理页，列表主体优先使用表格，不使用卡片墙式展示。
- 顶部工具条统一承载新增、刷新、检索。
- 单行操作统一放查看、编辑、删除。
- 新增、查看、编辑统一使用抽屉承载表单或详情。

## 原因

- 卡片墙在后台管理页的信息密度和操作效率都偏低，不利于批量扫描和稳定管理。
- 表格配合抽屉更符合配置型页面的主任务路径：先筛选定位，再对单条记录处理。

## 适用场景

- 设置页中的资源管理、配置管理、文件管理
- 需要头部工具条和单行操作的后台页面
- 详情编辑不需要跳转独立页面的管理界面
