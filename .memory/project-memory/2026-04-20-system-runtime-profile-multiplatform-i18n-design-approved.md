---
memory_type: project
topic: 宿主运行时画像、多平台 provider 打包与账号语言闭环设计已确认
summary: 自 `2026-04-20 00` 起，Rust provider 分发后续设计确认采用 6 target thin-package 发布、独立 `runtime-profile` 聚合接口、`host_fingerprint` 同机识别、`system_runtime.view.all` 权限点、用户 `preferred_locale` 闭环，以及“后端不做最终翻译、只返回 locale 与插件 i18n 资源”的宿主国际化边界；同时 official catalog 需支持按 `plugin_type` 过滤，并默认只返回当前宿主平台可安装 artifact。
keywords:
  - runtime-profile
  - host-fingerprint
  - preferred-locale
  - i18n
  - plugin
  - provider
  - windows
  - macos
match_when:
- 需要继续写 system runtime profile 相关实现 plan
- 需要判断 provider 发布链是否支持 Windows/macOS
- 需要实现用户语言偏好字段
- 需要统一插件与 model-provider 的 i18n contract
  - 需要设计官方插件目录按分类或平台过滤
created_at: 2026-04-20 00
updated_at: 2026-04-20 00
last_verified_at: 2026-04-20 00
decision_policy: verify_before_decision
scope:
  - docs/superpowers/specs/1flowbase/2026-04-20-system-runtime-profile-and-multiplatform-provider-packaging-design.md
  - api
  - scripts
  - ../1flowbase-official-plugins
---

# 宿主运行时画像、多平台 provider 打包与账号语言闭环设计已确认

## 结论

- 默认分发继续采用 `thin package`，不把多平台二进制塞进同一个默认 `.1flowbasepkg`。
- 正式 target 扩到 6 个：Linux `amd64/arm64`、macOS `amd64/arm64`、Windows `amd64/arm64`。
- `api-server` 新增 `GET /api/console/system/runtime-profile`，`plugin-runner` 新增内部 `GET /system/runtime-profile`，由前者聚合前者与后者的宿主快照。
- 同机识别不暴露原始 MAC，而是通过稳定系统标识或网卡标识集合生成 `host_fingerprint`。
- `runtime-profile` 只做轻量快照，至少输出平台、CPU、内存、uptime、service 状态，并同时返回 `bytes + gb`。
- 新增权限点 `system_runtime.view.all`；root 不受限制，非 root 需显式授权。
- 用户资料新增 `preferred_locale`，直接挂在现有 `/api/console/me` 读写里，不拆偏好接口。
- locale 优先级固定为：`query.locale > x-1flowbase-locale > user.preferred_locale > Accept-Language > en_US`。
- 宿主后端不负责最终翻译；只负责解析 locale、返回插件 i18n bundle、返回稳定 key/enum/number。
- `official-registry.json` 需要新增轻量 `i18n_summary`，使 official catalog 与 installed/plugin-provider catalog 可统一走 `i18n_catalog + namespace + key` contract。
- official catalog 需要显式增加 `plugin_type` 字段，并支持按 `plugin_type` 查询。
- official catalog 默认按当前宿主 `RuntimeTarget` 只返回一个最匹配 artifact，不把其他平台的完整 `artifacts[]` 原样暴露给普通前端页面。
