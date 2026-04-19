---
memory_type: project
topic: 官方插件发布签名链路
summary: `1flowbase-official-plugins` 的发布 workflow 现在要求使用 GitHub Secrets 中的官方 Ed25519 私钥签名插件包；主仓 API 通过 `API_OFFICIAL_PLUGIN_TRUSTED_PUBLIC_KEYS_JSON` 信任对应公钥，当前 key id 约定为 `official-key-2026-04`。
keywords:
  - plugin
  - signature
  - official release
  - github actions
  - key id
  - trusted public keys
match_when:
  - 需要维护官方插件发布流程
  - 需要调整官方插件签名密钥
  - 需要排查官方插件验签失败
created_at: 2026-04-19 17
updated_at: 2026-04-19 17
last_verified_at: 2026-04-19 17
decision_policy: verify_before_decision
scope:
  - host repo
  - official plugins repo
  - api
---

# 官方插件发布签名链路

## 时间

`2026-04-19 17`

## 谁在做什么

- 用户已经在 `1flowbase-official-plugins` 仓库配置了官方签名私钥。
- AI 负责把宿主打包 CLI、官方插件 release workflow 与 API 公钥信任配置接成一条完整链路。

## 为什么这样做

- 之前官方 release 只打包不签名，registry 条目标记为 unsigned，和主仓已经具备的验签能力脱节。
- 一旦镜像源或官方源要求 `signature_required`，未签名发布会直接导致安装失败。

## 为什么要做

- 让官方 release 产物内包含 `_meta/official-release.json` 和 `_meta/official-release.sig`。
- 让官方插件安装时能够被主仓 API 识别为 `verified_official`。

## 截止日期

- 未指定

## 决策背后动机

- 宿主 CLI `node scripts/node/plugin.js package` 新增可选签名参数：
  - `--signing-key-pem-file`
  - `--signing-key-id`
  - `--issued-at`
- `1flowbase-official-plugins/.github/workflows/provider-release.yml` 必须依赖两个 GitHub Secrets：
  - `OFFICIAL_PLUGIN_SIGNING_PRIVATE_KEY_PEM`
  - `OFFICIAL_PLUGIN_SIGNING_KEY_ID`
- 当前主仓 API 受信任 key id 已配置为 `official-key-2026-04`，发布侧必须使用同一个 key id。
