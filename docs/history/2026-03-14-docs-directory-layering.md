# 2026-03-14 Docs Directory Layering

## 背景

- `docs/dev/` 之前同时承载当前索引、带日期开发记录和过期文档，检索时容易把“当前有效文档”和“历史过程文档”混在一起。
- `runtime-foundation.md` 刚完成压缩后，若目录结构不继续收口，后续仍会出现主索引和历史留痕相互干扰的问题。

## 目标

- 将当前索引、历史记录、废弃归档拆成稳定目录结构。
- 让文档约定和实际落盘位置保持一致，避免规则与文件结构脱节。

## 决策与实现

- `docs/dev/` 只保留当前有效索引文档：
  - `runtime-foundation.md`
  - `user-preferences.md`
  - `README.md`
- 原 `docs/dev/` 下所有带日期开发记录统一迁移到 `docs/history/`。
- 废弃文档统一迁移到 `docs/expired/`。
- 同步更新以下文档中的目录约定：
  - `AGENTS.md`
  - `docs/product-design.md`
  - `docs/technical-design-supplement.md`
  - `docs/dev/runtime-foundation.md`
  - `docs/dev/user-preferences.md`
  - `docs/README.md`
  - `docs/dev/README.md`

## 影响范围

- 文档检索入口与目录约定
- 后续日期开发记录的落盘路径
- 废弃文档的归档路径
- 当前事实索引与历史留痕的职责边界

## 验证

- 确认 `docs/dev/` 仅剩当前索引文档。
- 确认日期开发记录已迁到 `docs/history/`。
- 确认废弃文档已迁到 `docs/expired/`。
- 确认关键文档中的目录约定与实际路径一致。

## 下一步

- 后续新增日期开发记录默认直接写入 `docs/history/`，不要再回放到 `docs/dev/` 根目录。
- 如后续出现新的归档需求，优先通过目录分层解决，而不是继续在单目录内堆叠命名约定。
