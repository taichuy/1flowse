---
memory_type: feedback
feedback_category: repository
topic: 模型供应商参数归供应商协议，上下文覆盖归模型配置且底层存纯数字
summary: 设计模型供应商参数、模型元信息和设置页模型配置时，`parameter_form` 应归供应商协议，`context_window` 覆盖应归单模型配置；界面可显示 `16K/1M` 等缩写，但数据库底层必须存纯数字。
keywords:
  - model-provider
  - parameter-form
  - context-window
  - configured-models
  - settings
  - llm
  - numeric-storage
  - display-format
match_when:
  - 调整模型供应商 options 合同中的参数 schema 归属
  - 设计模型上下文窗口、输出上限等模型级元信息
  - 调整设置页添加模型或编辑模型的字段结构
  - 设计缩写显示与数字持久化之间的转换规则
created_at: 2026-04-23 23
updated_at: 2026-04-23 23
last_verified_at: 2026-04-23 23
decision_policy: direct_reference
scope:
  - api/apps/api-server/src/routes/plugins_and_models/model_providers.rs
  - api/crates/control-plane/src/model_provider.rs
  - api/crates/domain/src/model_provider.rs
  - api/crates/storage-pg
  - web/app/src/features/settings/components/model-providers
  - web/app/src/features/agent-flow
  - docs/superpowers/specs
  - .memory/feedback-memory/repository
---

# 模型供应商参数归供应商协议，上下文覆盖归模型配置且底层存纯数字

## 时间

`2026-04-23 23`

## 规则

- `parameter_form` 属于供应商协议能力，应挂在 provider 级，不应在宿主侧按模型逐个复制维护。
- `context_window` 这类信息属于模型元信息；当需要人工兜底时，应放在单模型配置里，而不是供应商配置里。
- 模型上下文兜底字段应直接进入 `configured_models[*]` 之类的模型级配置结构，不要混入 `config_json` 这类供应商凭据配置。
- 界面层可以显示 `16K`、`32K`、`128K`、`1M` 这类缩写，但数据库和接口底层必须统一存纯数字 token 值。

## 原因

- 参数能力和模型元信息是两类不同性质的数据，混在一层会让插件边界和宿主边界一起变脏。
- 上下文窗口本来就可能因模型而异，不能因为供应商协议相同就提升为供应商级配置。
- 纯数字存储更稳定，后续无论展示格式、排序、比较还是运行时计算都更直接。

## 适用场景

- 调整模型供应商 `options`、catalog 或实例配置合同
- 调整 `openai_compatible` 之类供应商插件的参数 schema 与模型元信息适配
- 设计设置页“添加模型 / 编辑模型”行级字段
- 设计 `K/M` 缩写展示与持久化数字之间的转换逻辑

## 备注

- 这是一条仓库级分层规则，不是单次界面偏好。
- 如果未来需要更多模型级人工元信息字段，应优先继续挂到模型配置行，而不是重新回到供应商凭据层。
