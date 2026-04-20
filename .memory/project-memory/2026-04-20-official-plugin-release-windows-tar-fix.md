---
memory_type: project
topic: 官方插件 0.3.5 发布因 Windows tar 路径解析失败而部分发布
summary: `2026-04-20 16` 已确认 `1flowbase-official-plugins` 的 `openai_compatible-v0.3.5` 发布失败根因不是 Rust 编译，而是宿主仓 `scripts/node/plugin/core.js` 在 Windows runner 上把绝对输出路径传给 `tar -czf <path>`，被 Git for Windows 的 tar 误判为远端 `host:file` 语法；宿主仓已通过提交 `236d89c0` 改为由 Node 打开目标文件句柄并让 tar 输出到 stdout。当前 release 已有 darwin/linux 四个资产，但 `official-registry.json` 仍停在 `0.3.4`，需要在宿主修复进入远端后重新触发 release 链路，补齐 Windows 资产并更新官方索引。
keywords:
  - official-plugin
  - provider-release
  - windows
  - tar
  - openai_compatible
  - official-registry
match_when:
  - 需要排查官方插件 release 页面有资产但 official-registry 没更新
  - 需要解释 provider-release 在 Windows runner 上失败
  - 需要继续恢复 openai_compatible 0.3.5 官方发布链
created_at: 2026-04-20 16
updated_at: 2026-04-20 16
last_verified_at: 2026-04-20 16
decision_policy: verify_before_decision
scope:
  - scripts/node/plugin/core.js
  - scripts/node/plugin/_tests/core.test.js
  - ../1flowbase-official-plugins/.github/workflows/provider-release.yml
  - ../1flowbase-official-plugins/official-registry.json
---

# 官方插件 0.3.5 发布因 Windows tar 路径解析失败而部分发布

## 时间

`2026-04-20 16`

## 谁在做什么

AI 在主仓排查 `provider-release` 失败日志，并把宿主 `plugin package` 的 tar 打包实现改成 stdout 流式写包。

## 为什么这样做

失败日志显示两个 Windows matrix job 都在 Rust 编译完成后，统一死在 `tar (child): Cannot connect to ...pending.1flowbasepkg: resolve failed`。同一 run 的 darwin/linux job 已经成功产出 release assets，说明问题集中在 Windows 打包命令参数而不是发布动作本身。

## 为什么要做

当前 `openai_compatible-v0.3.5` release 页面已经存在 darwin/linux 四个 `.1flowbasepkg`，但由于 Windows job 失败，`update-official-registry` 被跳过，`official-registry.json` 仍停在 `0.3.4`。如果不修宿主打包 CLI，就会持续出现“release 页面和官方安装索引分叉”的状态。

## 截止日期

无

## 决策背后动机

优先修宿主打包源头，而不是在插件仓 workflow 里绕过 Windows 或放宽失败条件。根因已经定位到 `tar -czf <绝对 Windows 路径>` 的跨平台兼容性问题，直接改成 Node 管文件句柄、tar 输出到 stdout，能同时保留现有 tar 依赖和包格式，不需要为 Windows 单独分支 workflow。

## 关联文档

- `scripts/node/plugin/core.js`
- `scripts/node/plugin/_tests/core.test.js`
- `../1flowbase-official-plugins/.github/workflows/provider-release.yml`
