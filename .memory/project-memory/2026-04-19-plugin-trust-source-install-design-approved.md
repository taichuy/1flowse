---
memory_type: project
topic: 官方插件签名信任链与双入口安装方案已确认
summary: 用户于 `2026-04-19 13` 确认：官方插件后续要按“签名信任底座 + 镜像源 + 上传插件”三期推进；分发来源与信任级别必须拆开建模，来源固定区分 `official_registry`、`mirror_registry`、`uploaded`，信任级别固定区分 `verified_official`、`checksum_only`、`unverified`；镜像源和上传入口都不得绕开后端验签，上传来源即使导入官方离线包也仍记为 `uploaded`，只通过 `trust_level` 表达其是否为官方签发。
keywords:
  - official-plugin
  - signature-trust
  - mirror-registry
  - upload-install
  - trust-level
  - source-kind
match_when:
  - 需要继续实现官方插件镜像源安装
  - 需要新增浏览器上传插件安装
  - 需要判断来源字段和官方信任字段怎么拆
  - 需要判断上传的官方离线包应如何标记
created_at: 2026-04-19 13
updated_at: 2026-04-19 13
last_verified_at: 2026-04-19 13
decision_policy: verify_before_decision
scope:
  - docs/superpowers/specs/1flowbase/2026-04-19-plugin-trust-source-install-design.md
  - api/apps/api-server/src/config.rs
  - api/apps/api-server/src/official_plugin_registry.rs
  - api/apps/api-server/src/routes/plugins.rs
  - api/crates/control-plane/src/plugin_management.rs
  - api/crates/control-plane/src/ports.rs
  - api/crates/domain/src/model_provider.rs
  - api/crates/plugin-framework/src/provider_package.rs
  - web/app/src/features/settings/pages/SettingsPage.tsx
  - web/app/src/features/settings/components/model-providers/OfficialPluginInstallPanel.tsx
---

# 官方插件签名信任链与双入口安装方案已确认

本条记忆用于约束后续“镜像源 + 上传安装”实现方向：

- 不能把镜像源和上传入口当成单纯 UI 入口补丁，必须先补统一信任底座。
- `verification_status` 不再继续承担“官方验签通过”语义，后续实现应补 `trust_level`。
- `source_kind` 回答来源，`trust_level` 回答可信度，`signature_status` 回答签名诊断结果，三者不要再混用。
- 上传官方离线包时，来源仍是 `uploaded`；是否是官方包由验签结果决定。
