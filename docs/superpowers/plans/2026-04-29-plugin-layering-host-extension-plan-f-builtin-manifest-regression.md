# Plugin Layering Host Extension Plan F Builtin Manifest Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move builtin host manifests into `api/plugins/host-extensions/*`, add plugin set files, remove long-term api-server manifest ownership, and close the architecture slice with backend regression.

**Architecture:** Keep api-server as loader, policy, inventory, infrastructure bootstrap, route mount, and boot assembly. Builtin host module declarations become package-like source workspace entries under `api/plugins/host-extensions`; plugin sets select which package sources ship with a deployment profile.

**Tech Stack:** YAML manifests, Rust loader tests, plugin source workspace docs, backend verification script, qa-evaluation closeout.

---

## File Structure

**Create**
- `api/plugins/host-extensions/official.identity-host/manifest.yaml`
- `api/plugins/host-extensions/official.identity-host/host-extension.yaml`
- `api/plugins/host-extensions/official.workspace-host/manifest.yaml`
- `api/plugins/host-extensions/official.workspace-host/host-extension.yaml`
- `api/plugins/host-extensions/official.plugin-host/manifest.yaml`
- `api/plugins/host-extensions/official.plugin-host/host-extension.yaml`
- `api/plugins/host-extensions/official.local-infra-host/manifest.yaml`
- `api/plugins/host-extensions/official.local-infra-host/host-extension.yaml`
- `api/plugins/host-extensions/official.file-management-host/manifest.yaml`
- `api/plugins/host-extensions/official.file-management-host/host-extension.yaml`
- `api/plugins/host-extensions/official.runtime-orchestration-host/manifest.yaml`
- `api/plugins/host-extensions/official.runtime-orchestration-host/host-extension.yaml`
- `api/plugins/sets/minimal.yaml`
- `api/plugins/sets/default.yaml`

**Modify**
- `api/apps/api-server/src/host_extensions/builtin.rs`
- `api/apps/api-server/src/host_extension_boot.rs`
- `api/apps/api-server/src/_tests/host_extensions_builtin_tests.rs`
- `api/crates/control-plane/src/host_extension_boot/builtin.rs`
- `api/crates/control-plane/src/_tests/host_extension_builtin_tests.rs`
- `api/plugins/README.md`

### Task 1: Create Builtin Host Source Workspace Entries

**Files:**
- Create all `api/plugins/host-extensions/official.*` manifest pairs listed above.

- [ ] **Step 1: Add official host manifests**

For each host extension, create `manifest.yaml` with this shape:

```yaml
schema_version: 1flowbase.plugin.manifest/v1
manifest_version: 1
plugin_id: official.identity-host@0.1.0
version: 0.1.0
vendor: 1flowbase
display_name: Identity Host
description: Builtin identity host module.
source_kind: official_registry
trust_level: verified_official
consumption_kind: host_extension
execution_mode: in_process
slot_codes: [host_bootstrap]
binding_targets: []
selection_mode: auto_activate
minimum_host_version: 0.1.0
contract_version: 1flowbase.host_extension/v1
permissions:
  network: none
  secrets: host_managed
  storage: host_managed
  mcp: none
  subprocess: deny
runtime:
  protocol: native_host
  entry: host-extension.yaml
```

Use each extension's own `plugin_id`, `display_name`, and `description`.

- [ ] **Step 2: Add host-extension.yaml files**

For `official.local-infra-host`, include:

```yaml
schema_version: 1flowbase.host-extension/v1
extension_id: official.local-infra-host
version: 0.1.0
bootstrap_phase: pre_state
native:
  abi_version: 1flowbase.host.native/v1
  library: builtin://official.local-infra-host
  entry_symbol: builtin_local_infra_host
owned_resources: []
extends_resources: []
infrastructure_providers:
  - contract: storage-ephemeral
    provider_code: local
    config_ref: secret://system/official.local-infra-host/config
  - contract: cache-store
    provider_code: local
    config_ref: secret://system/official.local-infra-host/config
  - contract: distributed-lock
    provider_code: local
    config_ref: secret://system/official.local-infra-host/config
  - contract: event-bus
    provider_code: local
    config_ref: secret://system/official.local-infra-host/config
  - contract: task-queue
    provider_code: local
    config_ref: secret://system/official.local-infra-host/config
  - contract: rate-limit-store
    provider_code: local
    config_ref: secret://system/official.local-infra-host/config
routes: []
workers: []
migrations: []
```

For other official host extensions, set `bootstrap_phase: boot`, empty infrastructure providers, and their owned/extended resources according to current builtin manifest intent.

- [ ] **Step 3: Validate YAML paths**

Run:

```bash
find api/plugins/host-extensions -maxdepth 2 -name '*.yaml' -print | sort
```

Expected: every created directory has both `manifest.yaml` and `host-extension.yaml`.

- [ ] **Step 4: Commit workspace entries**

```bash
git add api/plugins/host-extensions
git commit -m "feat: add builtin host extension source manifests"
```

### Task 2: Add Plugin Sets

**Files:**
- Create: `api/plugins/sets/minimal.yaml`
- Create: `api/plugins/sets/default.yaml`
- Modify: `api/plugins/README.md`

- [ ] **Step 1: Add minimal set**

Create:

```yaml
schema_version: 1flowbase.plugin-set/v1
set_id: minimal
host_extensions:
  - official.identity-host
  - official.workspace-host
  - official.plugin-host
  - official.local-infra-host
runtime_extensions: []
capability_plugins: []
```

- [ ] **Step 2: Add default set**

Create:

```yaml
schema_version: 1flowbase.plugin-set/v1
set_id: default
host_extensions:
  - official.identity-host
  - official.workspace-host
  - official.plugin-host
  - official.local-infra-host
  - official.file-management-host
  - official.runtime-orchestration-host
runtime_extensions: []
capability_plugins: []
```

- [ ] **Step 3: Document sets in plugin README**

Add:

```markdown
`sets/minimal.yaml` and `sets/default.yaml` select package sources for deployment assembly. They do not make plugin source code part of `api-server`; selected plugins still move through package/install/load lifecycle.
```

- [ ] **Step 4: Commit plugin sets**

```bash
git add api/plugins/sets api/plugins/README.md
git commit -m "feat: add builtin plugin set manifests"
```

### Task 3: Rewire Builtin Manifest Loading

**Files:**
- Modify: `api/apps/api-server/src/host_extensions/builtin.rs`
- Modify: `api/apps/api-server/src/host_extension_boot.rs`
- Modify: `api/apps/api-server/src/_tests/host_extensions_builtin_tests.rs`
- Modify: `api/crates/control-plane/src/host_extension_boot/builtin.rs`
- Modify: `api/crates/control-plane/src/_tests/host_extension_builtin_tests.rs`

- [ ] **Step 1: Add RED tests**

Tests must assert:

```text
builtin manifests are loaded from api/plugins/host-extensions paths
api-server builtin.rs no longer stores full YAML manifest strings
default set contains local-infra-host before boot-phase modules
missing manifest path fails with a clear load error
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p api-server host_extensions_builtin -- --nocapture
cargo test -p control-plane host_extension_builtin -- --nocapture
```

Expected: FAIL while loader still reads hard-coded YAML constants.

- [ ] **Step 3: Implement file-backed builtin loading**

Change `builtin.rs` from full YAML constants to a path list:

```rust
pub fn builtin_host_extension_manifest_paths() -> Vec<&'static str> {
    vec![
        "plugins/host-extensions/official.identity-host/manifest.yaml",
        "plugins/host-extensions/official.workspace-host/manifest.yaml",
        "plugins/host-extensions/official.plugin-host/manifest.yaml",
        "plugins/host-extensions/official.local-infra-host/manifest.yaml",
        "plugins/host-extensions/official.file-management-host/manifest.yaml",
        "plugins/host-extensions/official.runtime-orchestration-host/manifest.yaml",
    ]
}
```

Resolve paths from `api/` workspace root in tests and from configured install/source root in runtime.

- [ ] **Step 4: Re-run builtin tests**

Run:

```bash
cd api
cargo test -p api-server host_extensions_builtin -- --nocapture
cargo test -p control-plane host_extension_builtin -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Commit loader rewire**

```bash
git add api/apps/api-server/src/host_extensions/builtin.rs api/apps/api-server/src/host_extension_boot.rs api/apps/api-server/src/_tests/host_extensions_builtin_tests.rs api/crates/control-plane/src/host_extension_boot/builtin.rs api/crates/control-plane/src/_tests/host_extension_builtin_tests.rs
git commit -m "refactor: load builtin host manifests from plugin workspace"
```

### Task 4: Update Final Docs And Remove Old Claims

**Files:**
- Modify: `api/plugins/README.md`
- Modify: `api/README.md`
- Modify: `README.md`

- [ ] **Step 1: Remove old builtin ownership claims**

Search:

```bash
rg -n "builtin host manifest|API_EPHEMERAL_BACKEND|RedisBackedSessionStore|storage-redis|only data-source" README.md api/README.md api/plugins/README.md api/AGENTS.md
```

Expected before edit: any stale matches are reviewed.

- [ ] **Step 2: Update docs**

Docs must state:

```text
api-server owns loader, policy, inventory, infra bootstrap, route mount, and boot assembly
plugin source workspace owns host-extension source manifests and templates
runtime-extension packages continue to use plugin-runner
capability-plugin packages are workspace-selectable abilities
```

- [ ] **Step 3: Verify stale claims are gone**

Run:

```bash
rg -n "API_EPHEMERAL_BACKEND|RedisBackedSessionStore|storage-redis|only data-source" README.md api/README.md api/plugins/README.md api/AGENTS.md
```

Expected: no stale target-architecture matches.

- [ ] **Step 4: Commit docs cleanup**

```bash
git add README.md api/README.md api/plugins/README.md api/AGENTS.md
git commit -m "docs: align host extension closeout docs"
```

### Task 5: Final Regression And QA

**Files:**
- Verify only.

- [ ] **Step 1: Format**

Run:

```bash
cd api
cargo fmt
```

Expected: no uncommitted formatting diff remains.

- [ ] **Step 2: Run full backend verification**

Run from repository root:

```bash
node scripts/node/verify-backend.js
```

Expected: PASS. Store warning and coverage artifacts under `tmp/test-governance/` if generated.

- [ ] **Step 3: Run qa-evaluation**

Use `qa-evaluation` for closeout. The QA report must cover:

```text
HostExtension manifest and load-plan validation
pre-state infrastructure bootstrap
Resource Action Kernel migrated actions
route/worker/migration registries
builtin manifest source workspace migration
remaining un-migrated routes that are not yet HostExtension extension points
```

- [ ] **Step 4: Commit final verification docs if produced**

If QA produces tracked docs or updates plan status, commit them:

```bash
git add docs tmp/test-governance
git commit -m "test: close host extension realignment regression"
```

Do not commit ignored transient logs.
