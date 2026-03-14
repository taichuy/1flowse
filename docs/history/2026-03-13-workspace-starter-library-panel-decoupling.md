# 2026-03-13 Workspace Starter Library Panel Decoupling

## 背景

在前一轮已经抽出 `shared.ts` 与 `use-workspace-starter-source.ts` 之后，`web/components/workspace-starter-library.tsx` 仍然同时承担：

- hero 概览渲染
- 列表筛选与批量治理面板
- starter metadata 编辑面板
- definition snapshot 预览面板

这让主组件继续停留在“大型 orchestration + 大量 JSX”的混合状态，和当前用户关于文件体量控制、职责解耦的长期偏好并不完全一致。

## 目标

- 把稳定 UI 分区继续从主壳层里拆开
- 保持现有行为与数据契约不变
- 让后续 workspace starter 主线继续演进时，新增能力优先挂到子面板而不是回流到单文件

## 本轮实现

- 新增 `web/components/workspace-starter-library/hero-section.tsx`
  - 单独承载顶部 hero / governance summary 呈现
- 新增 `web/components/workspace-starter-library/template-list-panel.tsx`
  - 承载列表筛选、搜索、批量治理和 starter 卡片渲染
- 新增 `web/components/workspace-starter-library/starter-metadata-panel.tsx`
  - 承载 metadata 编辑表单与单模板治理动作
- 新增 `web/components/workspace-starter-library/definition-snapshot-panel.tsx`
  - 承载 definition snapshot、source status 与节点预览
- 将 `web/components/workspace-starter-library.tsx` 进一步收敛为状态编排壳层

## 影响范围

- `web/components/workspace-starter-library.tsx`
- `web/components/workspace-starter-library/*.tsx`
- workspace starter 页面行为保持不变，但边界更适合继续补 rebase / drift / library governance

## 验证方式

- 建议执行 `pnpm exec tsc --noEmit`

## 未决问题

- 主组件虽然已明显收缩，但后续若继续增加治理动作，可再评估把 mutation handlers 收口到专用 hook
- `web/lib/get-workspace-starters.ts` 与 `web/lib/get-workflow-publish.ts` 仍是前端数据层的潜在下一个热点

## 下一步

1. 优先继续承接 publish P0 主线，补 `streaming / SSE` 与 waiting lifecycle drilldown
2. 紧接着治理 `api/app/services/runtime.py` 与 `api/tests/test_runtime_service.py`
3. 再继续收口 workspace starter / diagnostics 数据层热点，避免新的大文件回流
