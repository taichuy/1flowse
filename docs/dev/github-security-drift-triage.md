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
- 本地 manifest inventory（当前原生 dependency graph coverage 根是 `web` 的 `package.json + pnpm-lock.yaml`；本地 drift 解析仍额外覆盖 `api/`、`services/compat-dify/` 的 `pyproject.toml + uv.lock`）
- 与本地 `pnpm-lock.yaml` / `uv.lock` 和对应 `package.json` / `pyproject.toml` 的版本对比

如果在 GitHub Actions 中运行，脚本还会把结论写入 `GITHUB_STEP_SUMMARY`，方便在 workflow 页面直接查看证据。

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
3. 如果脚本显示 `dependencyGraphManifests` 为空，或 `graph coverage 缺口` 仍覆盖本地 manifest roots：
   - 到仓库 `Settings -> Security & analysis` 检查 `Dependency graph` 是否开启。
   - 如仓库策略允许，再检查 `Automatic dependency submission` 是否已配置并正常跑在默认分支。
   - 再检查 `.github/workflows/dependency-graph-submission.yml` 是否已在默认分支成功提交 `web/pnpm-lock.yaml` 的手工 snapshot；该 workflow 只用 `github.token + contents:write` 和本地 `pnpm list --lockfile-only` 构建事实，不依赖第三方 action 或远程脚本。
   - 当前 `uv` roots 不再计入“原生 graph coverage 缺口”；如果后续确实希望 Python `uv` 目录也进入 GitHub dependency graph / alert drift 对照，应另行补 dependency submission API，而不是继续把它误判成管理员开关问题。
4. 不要因为 UI 暂时没刷新就直接 dismiss alert；应先保留命令输出、锁文件事实和结论，再等待依赖图恢复或补管理员侧操作。

## 仓库自动复验

- 仓库提供 `.github/workflows/github-security-drift.yml`，会在以下时机自动复验：
  - 手动 `workflow_dispatch`
  - 每日定时 `schedule`
  - `taichuy_dev` 上任意受脚本监控的 manifest（`**/package.json`、`**/pnpm-lock.yaml`、`**/pyproject.toml`、`**/uv.lock`）或 `scripts/check-dependabot-drift.js` 的 push
- 工作流会上传 `dependabot-drift-report` artifact，并把摘要写入 workflow summary。
- 工作流会优先读取仓库 secret `DEPENDABOT_ALERTS_TOKEN`；如果未配置，则退回 `github.token`，并在无法读取 Dependabot alerts 时输出降级 warning，而不是把整条自动复验链直接打断。
- exit code 解释与本地一致：
  - `0`：没有 open alert
  - `1`：仍有真实未修或无法解析的告警，工作流失败
  - `2`：已确认是平台状态漂移，工作流保留 warning 与证据，但不把本轮代码视为失败
-  `3`：workflow token 无法读取 Dependabot alerts；工作流会继续保留 dependency graph 事实与 warning，但完整 drift 对比仍需 `DEPENDABOT_ALERTS_TOKEN` 或本地 `gh` 凭证。
- 当管理员完成 `Security & analysis` 检查后，优先手动重跑该 workflow，再判断告警是否自动收口。

## 显式 dependency submission

- 仓库新增 `.github/workflows/dependency-graph-submission.yml`，会在 `workflow_dispatch`、每日定时和 `taichuy_dev` 上的 `package.json` / `pnpm-lock.yaml` 变更时执行。
- 当前它使用 `scripts/submit-dependency-snapshots.js` 为所有 pnpm roots 提交手工 snapshot；按当前代码事实，实际命中的 root 是 `web`。
- 该脚本直接调用 GitHub dependency submission REST API，提交 `web/pnpm-lock.yaml` 的 runtime resolved tree，并保留 `direct|indirect` 关系事实；这已经足以覆盖当前 `next` / `flatted` 这类 default branch runtime 告警主线。
- 当前 `pnpm list --lockfile-only` 在本仓库下还不能稳定暴露 development roots，所以 workflow summary 会显式提示这仍是“先收口 runtime dependency graph 覆盖”的中间态，不要误以为 devDependencies 已全部进入 GitHub graph。
- 这样做的目标不是替代 `github-security-drift` 的告警比对，而是把 `web` 的 dependency graph 覆盖从“依赖平台自动识别是否稳定”收口成“仓库自己显式提交一份最高优先级 runtime snapshot”。
- 如果 workflow 成功但 `dependencyGraphManifests` 仍长期缺少 `web/pnpm-lock.yaml`，说明平台侧仍可能存在刷新延迟或权限异常，应优先保留该 workflow run 证据，再继续管理员侧排查。

## 当前仓库已验证的信号

- `web/package.json` 已把 `next` 固定到 `^15.5.14`，并把 `eslint-config-next` 对齐到 `^15.5.14`。
- `web/package.json` 的 `pnpm.overrides` 已把 `flatted` 固定到 `3.4.2`。
- `web/pnpm-lock.yaml` 已解析到 `next@15.5.14` 与 `flatted@3.4.2`。

因此，当 GitHub 仍报告这两个依赖的 open alert 时，应优先按“平台状态漂移”而不是“本地锁文件仍未修复”处理。

当前脚本已把 `uv` 根从“应出现在 GitHub 原生 dependency graph 里的 coverage 缺口”里剥离，只把它保留为本地告警版本解析能力。换句话说：

- `web` 的 `pnpm` 根仍应作为 GitHub 原生 dependency graph / automatic dependency submission 的事实来源；如果它缺席，优先排查管理员设置或工作流侧 submission。
- `api/`、`services/compat-dify/` 的 `uv` 根默认不会被脚本误报成“管理员没开 dependency graph”；若后续确实需要它们出现在 GitHub graph / alert drift 视图中，应新增显式 dependency submission 流程。

如果后续 GitHub 开始返回 Python 生态告警，脚本也会优先使用对应目录下的 `uv.lock` 解析实际版本，并回看 `pyproject.toml` 中的声明 specifier；不要再把 Python 告警手动降级为“脚本不支持”。

新增 `uv` / `pnpm` manifest root 时，优先保持文件名落在上述受支持集合内；workflow path filter 会自动命中，不需要再为具体目录手工补一轮枚举。
