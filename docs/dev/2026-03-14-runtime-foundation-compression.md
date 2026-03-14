# 2026-03-14 Runtime Foundation Compression

## 背景

- `docs/dev/runtime-foundation.md` 经过多轮直接追加后，已从“当前事实索引”膨胀为长篇历史流水账。
- 旧版主文档虽然保留了过程信息，但检索成本过高，已经削弱了它作为后续开发第一参考的作用。

## 目标

- 把 `runtime-foundation.md` 压回适合日常开发快速对齐的短版索引。
- 保留当前项目最重要的代码事实、结构热点和优先级顺序。
- 不丢失旧文档的追溯价值，并保留现有“下一步规划”内容。

## 决策与实现

- 将旧版主文档归档为 `docs/dev/2026-03-14-runtime-foundation-history-expired.md`，并按废弃文档规范补充原因、替代文档和日期。
- 重写 `docs/dev/runtime-foundation.md`，只保留：
  - 当前判断
  - 当前代码事实
  - 当前结构热点
  - 本轮压缩说明
  - 原样保留的下一步规划
- 将“runtime-foundation 过长时优先压缩”同步记录到 `docs/dev/user-preferences.md` 与 `AGENTS.md`，把这件事从一次性处理提升为长期协作规则。

## 影响范围

- `docs/dev/runtime-foundation.md`
- `docs/dev/user-preferences.md`
- `AGENTS.md`
- 后续所有任务的文档收尾与事实同步方式

## 验证

- 以当前代码现状复核压缩内容，重点核对：
  - 运行时主服务与已拆分的 publish gateway 子模块
  - run / publish / system / credential 等现有 API 路由
  - 最新迁移版本与当前结构热点文件体量
- 压缩后的主文档应明显短于原版，并继续保留现有“下一步规划”。

## 下一步

- 后续如 `runtime-foundation.md` 再次膨胀，应优先做“主文档压缩 + 历史归档”，而不是继续在主文档中无限追加轮次记录。
