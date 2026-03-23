# GitHub 安全告警漂移排查

开始前先读 `AGENTS.md`、`docs/AGENTS.md` 与 `docs/dev/team-conventions.md`。

## 适用场景

- GitHub Security / Dependabot 仍显示 `open`，但本地锁文件和 `pnpm audit` 已经升级到 patched version。
- 需要判断这是“仓库仍有真实漏洞”，还是“GitHub dependency graph / alert state 尚未刷新”。

## 快速执行

在仓库根目录运行：

```bash
node scripts/check-dependabot-drift.js
```

脚本会显式调用 `gh api` 查询当前仓库的：

- 默认分支
- GraphQL `dependencyGraphManifests`
- Dependabot open alerts
- 与本地 `pnpm-lock.yaml`、`package.json` 的版本对比

## 结果解释

- `exit 0`
  - 当前没有 open alert。
- `exit 1`
  - 至少一个告警在本地锁文件里仍低于 patched version，或脚本无法解析当前依赖事实。
  - 这时优先修依赖、补锁文件，再重新验证。
- `exit 2`
  - GitHub 仍有 open alert，但脚本确认本地锁文件版本已经达到 patched version。
  - 这通常表示 GitHub 的 dependency graph / alert state 与默认分支事实发生了漂移。

## 推荐排查顺序

1. 先运行 `node scripts/check-dependabot-drift.js`。
2. 再运行 `cd web && corepack pnpm audit --registry=https://registry.npmjs.org --json`，确认 npm registry 视角也没有新漏洞。
3. 如果脚本显示 `dependencyGraphManifests` 为空或明显少于预期：
   - 到仓库 `Settings -> Security & analysis` 检查 `Dependency graph` 是否开启。
   - 如仓库策略允许，再检查 `Automatic dependency submission` 是否已配置并正常跑在默认分支。
4. 不要因为 UI 暂时没刷新就直接 dismiss alert；应先保留命令输出、锁文件事实和结论，再等待依赖图恢复或补管理员侧操作。

## 当前仓库已验证的信号

- `web/package.json` 已把 `next` 固定到 `^15.5.14`，并把 `eslint-config-next` 对齐到 `^15.5.14`。
- `web/package.json` 的 `pnpm.overrides` 已把 `flatted` 固定到 `3.4.2`。
- `web/pnpm-lock.yaml` 已解析到 `next@15.5.14` 与 `flatted@3.4.2`。

因此，当 GitHub 仍报告这两个依赖的 open alert 时，应优先按“平台状态漂移”而不是“本地锁文件仍未修复”处理。
