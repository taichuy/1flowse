# Plugin Layering Host Extension Plan A Local Rules And Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align local rules, plugin docs, and env examples with the new HostExtension target architecture before backend code changes.

**Architecture:** This plan changes documentation only. It makes `api/AGENTS.md`, plugin README, API README, and env examples reflect the execution addendum: no Core Redis env target, HostExtension source workspaces under `api/plugins`, and pre-state infrastructure provider bootstrap as the future startup path.

**Tech Stack:** Markdown, env example files, ripgrep verification, git commit.

---

## Source Documents

- `docs/superpowers/specs/2026-04-29-plugin-layering-and-host-extension-realignment-design.md`
- `docs/superpowers/specs/2026-04-29-plugin-layering-and-host-extension-realignment-execution-addendum.md`
- `api/AGENTS.md`

## File Structure

**Modify**
- `api/AGENTS.md`: backend hard rules for HostExtension, Resource Action Kernel, infrastructure contracts, and plugin source workspace.
- `api/plugins/README.md`: plugin source workspace and package/install boundaries.
- `api/README.md`: module map and backend verification notes.
- `api/apps/api-server/.env.example`: remove old Redis backend target shape and add plugin set / secret resolver example keys.
- `api/apps/api-server/.env.production.example`: mirror production env example changes.

### Task 1: Freeze Backend Local Rules

**Files:**
- Modify: `api/AGENTS.md`

- [ ] **Step 1: Update rules for new target architecture**

Edit `api/AGENTS.md` so the Local Rules include these exact rules in the HostExtension block:

```markdown
- `HostExtension` v1 使用可信 native in-process，随主进程 boot-time 加载；启停、升级只写 desired state，并在重启后生效。
- `HostExtension` 不做 Rust native `so/dll` 热卸载；可重复卸载的第三方运行时按 WASM 或 Lua 单独设计，不纳入本轮 native HostExtension v1。
- `HostExtension` 实现或增强 host contract 时，必须通过 manifest 声明 contribution；native entrypoint 只能注册已声明的 resource、action、hook、route、worker、migration 和 infrastructure provider。
- `pre-state infra provider bootstrap` 必须发生在 `ApiState`、session store、control-plane service、runtime engine 和 HTTP router 构造前。
- `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` 是宿主基础设施 contract；具体 Redis、NATS、RabbitMQ 等实现只能作为 HostExtension provider。
- `API_EPHEMERAL_BACKEND=redis` 不再是目标架构；Core 不通过 env 分支直接选择 Redis session store。
- Core 写动作要逐步进入 `Resource Action Kernel`；未进入 kernel 的 route 不作为 HostExtension hook 扩展点。
- HostExtension migration 只能写 `ext_<normalized_extension_id>__*` 命名空间，不得修改 Core 真值表。
```

- [ ] **Step 2: Verify rule text exists**

Run:

```bash
rg -n "pre-state infra provider bootstrap|Resource Action Kernel|API_EPHEMERAL_BACKEND=redis|ext_<normalized_extension_id>" api/AGENTS.md
```

Expected: all four phrases are found.

- [ ] **Step 3: Commit local rules**

```bash
git add api/AGENTS.md
git commit -m "docs: align backend host extension rules"
```

### Task 2: Update Plugin Workspace Documentation

**Files:**
- Modify: `api/plugins/README.md`
- Modify: `api/README.md`

- [ ] **Step 1: Replace plugin README with the new workspace layout**

Ensure `api/plugins/README.md` describes this structure:

```markdown
api/plugins/
  host-extensions/<extension_id>/
  runtime-extensions/<plugin_id>/
  capability-plugins/<plugin_id>/
  templates/
  sets/
  packages/
  installed/
  fixtures/
```

Document these rules:

```markdown
- Source workspace location does not decide whether something is a plugin; package/install/enable-disable/load lifecycle does.
- `packages/` stores `.1flowbasepkg` artifacts only.
- `installed/` stores installed package results only.
- `host-extensions/*` packages are system/root HostExtension sources and are not statically linked into `api-server`.
- `runtime-extensions/*` packages implement registered runtime slots through plugin-runner.
- `capability-plugins/*` packages contribute workspace-selected app/workflow capabilities.
```

- [ ] **Step 2: Update API README module map**

In `api/README.md`, update the plugin line so it points to all three plugin source workspaces and notes that `api/plugins/templates/data_source_http_fixture` is a runtime-extension template, not the only plugin template.

- [ ] **Step 3: Verify docs no longer describe only data-source plugins**

Run:

```bash
rg -n "host-extensions|runtime-extensions|capability-plugins|packages/|installed/" api/plugins/README.md api/README.md
```

Expected: both files mention the new plugin workspace model.

- [ ] **Step 4: Commit plugin docs**

```bash
git add api/plugins/README.md api/README.md
git commit -m "docs: document plugin source workspaces"
```

### Task 3: Update Env Examples

**Files:**
- Modify: `api/apps/api-server/.env.example`
- Modify: `api/apps/api-server/.env.production.example`

- [ ] **Step 1: Remove Core Redis backend target env**

Delete these keys from both env example files:

```dotenv
API_EPHEMERAL_BACKEND=memory
# API_EPHEMERAL_REDIS_URL=redis://:1flowbase@127.0.0.1:36379
```

Add these keys:

```dotenv
API_PLUGIN_SET=default
API_SECRET_RESOLVER=env
```

Keep database, root bootstrap, plugin runner, and install-root env values untouched.

- [ ] **Step 2: Verify old env target is gone**

Run:

```bash
rg -n "API_EPHEMERAL_BACKEND|API_EPHEMERAL_REDIS_URL" api/apps/api-server/.env.example api/apps/api-server/.env.production.example
```

Expected: no matches.

- [ ] **Step 3: Verify new env target exists**

Run:

```bash
rg -n "API_PLUGIN_SET|API_SECRET_RESOLVER" api/apps/api-server/.env.example api/apps/api-server/.env.production.example
```

Expected: both files contain both keys.

- [ ] **Step 4: Commit env docs**

```bash
git add api/apps/api-server/.env.example api/apps/api-server/.env.production.example
git commit -m "docs: update host infrastructure env examples"
```

### Task 4: Plan A Verification

**Files:**
- Verify only.

- [ ] **Step 1: Check worktree**

Run:

```bash
git status --short
```

Expected: clean worktree.

- [ ] **Step 2: Record completion**

Mark Plan A complete in the index if your execution workflow tracks plan status inside docs.
