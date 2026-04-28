# N6 Vite 主 Chunk 优化执行报告

## 范围

涉及区域：

- `web/app/src/app/router.tsx`
- `web/app/src/features/applications/pages/ApplicationDetailPage.tsx`
- `web/app/src/features/agent-flow/pages/AgentFlowEditorPage.tsx`
- `web/app/src/features/settings/pages/SettingsPage.tsx`
- `web/app/src/features/settings/pages/settings-page/SettingsSectionBody.tsx`
- `web/app/src/features/settings/components/ApiDocsPanel.tsx`
- `web/app/vite.config.ts`

## 原始现状

优化前 build 通过，但 Vite 提示主 chunk 超过 500 kB。

最新 build 证据：

- `dist/assets/index-*.js`
  - 约 `5,978 kB minified`
  - 约 `1,742 kB gzip`
- `AgentScalarChatInterface.vue-*.js`
  - 约 `144 kB`

主 chunk 体积不是单点小问题，而是入口静态 import 造成的系统性打包问题。

## 归因

当前 `router.tsx` 静态 import 多个大页面：

- `ApplicationDetailPage`
- `SettingsPage`
- `HomePage`
- `MePage`
- `EmbeddedAppsPage`
- `ToolsPage`

其中两条链路特别重：

- `router.tsx -> ApplicationDetailPage -> AgentFlowEditorPage`
  - 带入 ReactFlow、Lexical、Monaco、Agent Flow canvas/debug/detail 等链路。
- `SettingsSectionBody -> ApiDocsPanel`
  - 带入 Scalar API Reference 与相关样式/副作用。

因此，单靠 `manualChunks` 并不能解决首屏加载量问题。它只能改变 chunk 分布和缓存策略；如果入口仍静态 import 大页面，首屏仍可能需要过多代码。

## 执行路线

### 阶段 1：Route 级 Lazy

已执行：

- `ApplicationDetailPage`
- `SettingsPage`

预期收益：

- 登录页、首页、普通壳层不再提前加载应用详情与设置详情代码。
- 初始 chunk 明显下降。

已处理风险：

- 补充 `Suspense` loading boundary。
- 修正 settings legacy tests 的等待方式和 API mock 覆盖，避免依赖动态导入时机。
- 增加 vite config 测试覆盖动态 import 约束。

### 阶段 2：Section 级 Lazy

已执行：

- `AgentFlowEditorPage`
- `ApplicationLogsPage`
- `ApiDocsPanel`
- `SettingsModelProvidersSection`
- `SettingsFilesSection`

预期收益：

- 应用详情非 orchestration section 不加载画布编辑器。
- 设置页非 docs section 不加载 Scalar。

已处理风险：

- 保留 settings 成员、角色、系统运行为静态 section，避免小体积区域为了拆包制造测试复杂度。
- Scalar 仍在 `ApiDocsPanel` lazy chunk 内初始化，不进入入口 chunk。

### 阶段 3：组件级 Lazy

已执行：

- `NodeRunIOCard` 中的 Monaco JSON viewer。

预期收益：

- 进一步减少打开画布但未查看运行 IO / debug markdown 时的成本。

已处理风险：

- 增加运行 IO JSON viewer loading 状态。
- `monaco-vendor` 独立 chunk，避免 Monaco 进入主业务入口。

### 阶段 4：manualChunks

已执行：

- React / ReactDOM
- antd
- @xyflow/react
- Monaco

定位：

- 用于稳定 vendor 缓存。
- 不把 Scalar 强拆到全局 vendor，避免 Rollup circular chunk warning；Scalar 保留在 docs lazy chunk 内。

## 当前 build 证据

命令：

- `pnpm --dir web/app build`

结果：

- build 通过。
- build 输出无 Vite `Some chunks are larger than 500 kB` 警告。
- 入口业务 chunk `dist/assets/index-*.js` 约 `94.52 kB minified / 18.46 kB gzip`。
- `ApplicationDetailPage-*.js` 约 `10.23 kB minified / 2.27 kB gzip`。
- `SettingsPage-*.js` 约 `70.74 kB minified / 11.32 kB gzip`。
- `AgentFlowEditorPage-*.js` 约 `320.43 kB minified / 64.26 kB gzip`。
- `react-vendor-*.js` 约 `854.65 kB minified / 274.59 kB gzip`。
- `antd-vendor-*.js` 约 `1,169.63 kB minified / 369.50 kB gzip`。
- `ApiDocsPanel-*.js` 约 `2,931.24 kB minified / 861.97 kB gzip`，已隔离为 docs lazy chunk。

## 当前状态

本报告已从预研转为执行完成记录。

本轮已确认：

- build 可通过。
- Vite 500 kB chunk warning 已清除。
- 主入口业务 chunk 已从约 `5.98 MB minified / 1.74 MB gzip` 降至约 `94.52 kB minified / 18.46 kB gzip`。
- 最大剩余 chunk 为 `ApiDocsPanel`，但已从入口隔离，只在打开 API 文档时加载。

## 后续建议

- 若继续治理性能预算，优先对 `ApiDocsPanel` / Scalar 链路做 bundle stats 分析。
- `manualChunks` 后续应保持克制，避免为了压 warning 制造循环 chunk 或过度碎片化。
