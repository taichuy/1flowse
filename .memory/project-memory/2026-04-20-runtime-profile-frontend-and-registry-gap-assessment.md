---
memory_type: project
topic: runtime-profile rollout 当前卡点已明确为前端未消费与 official registry 未同步
summary: `2026-04-20 15` 现场排查确认：`docs/superpowers/plans/2026-04-20-system-runtime-profile-multiplatform-packaging-and-i18n.md` 已将 frontend page refactor 列为 out of scope，本轮后端已补齐 `preferred_locale`、`/api/console/system/runtime-profile`、`plugin_type` 过滤与 i18n contract；但 `web` 端尚未消费这些新 contract，设置页没有 system runtime 入口，`/me` 也没有语言选择 UI，同时 official registry 对外与本地生成文件仍停留在未包含 `plugin_type/i18n_summary` 的旧数据形态，因此现象不是“用户看漏了”，而是“前端未做完 + registry 发布未同步”。
keywords:
  - runtime-profile
  - preferred-locale
  - plugin-type
  - official-registry
  - frontend-gap
  - settings
match_when:
  - 用户询问为什么 settings 里看不到 system runtime 或语言选择
  - 用户询问 official plugin catalog 为什么没有分类
  - 需要判断 runtime-profile rollout 下一步该修 registry 还是开始做前端
created_at: 2026-04-20 15
updated_at: 2026-04-20 15
last_verified_at: 2026-04-20 15
decision_policy: verify_before_decision
scope:
  - docs/superpowers/plans/2026-04-20-system-runtime-profile-multiplatform-packaging-and-i18n.md
  - api/apps/api-server/src/routes/system.rs
  - api/apps/api-server/src/routes/me.rs
  - api/apps/api-server/src/routes/plugins.rs
  - web
  - ../1flowbase-official-plugins
---

# runtime-profile rollout 当前卡点已明确为前端未消费与 official registry 未同步

## 当前事实

- 计划文档已明确把 frontend page refactor 排除在当前 rollout 之外，因此本轮实现完成后，settings 里没有 runtime-profile 页面和语言选择入口是预期现象，不是用户漏看。
- 后端接口已具备：
  - `/api/console/system/runtime-profile`
  - `/api/console/me` 读写 `preferred_locale`
  - `/api/console/plugins/*` 支持 `plugin_type` 过滤与 i18n contract
- `web` 侧尚未跟进：
  - settings 导航只有 `docs/model-providers/members/roles`
  - `/me` API client 和表单未包含 `preferred_locale`
  - settings 插件请求没有传 `plugin_type`，类型定义也未暴露 `plugin_type/selected_artifact`
- `../1flowbase-official-plugins/scripts/build-registry-entry.mjs` 已能生成 `plugin_type/i18n_summary/artifacts`，但本地 `official-registry.json` 与线上 raw registry 仍是旧形态，说明发布或同步链路没有闭环到最终 registry 文件。

## 建议顺序

1. 先修 official registry 最终产物与 API 配置来源，确保线上 catalog 真正带上新 schema。
2. 再做 `web` 前端消费：
   - settings 新增 system runtime 入口
   - `/me` 增加语言下拉
   - settings 插件/模型供应商页对齐 `plugin_type + i18n` contract

## 为什么记录

- 这条结论会直接影响下一步开发顺序；如果不记录，后续会重复误判成“后端没做完”或“用户没找到入口”。
