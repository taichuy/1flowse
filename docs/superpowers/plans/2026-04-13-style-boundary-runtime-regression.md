# Style Boundary Runtime Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-backed style-boundary regression workflow for `web/` that can run component, page, and file-targeted checks without depending on product navigation or full E2E flows.

**Architecture:** Add a dedicated `style-boundary.html` Vite entry plus a React harness inside `web/app`, backed by a JSON scene manifest and a typed render registry. A root `scripts/node/check-style-boundary.js` command will reuse the managed frontend dev server, load Playwright from the `web` workspace, render target scenes in headless Chrome, collect computed-style and matched-selector evidence, and write failure screenshots to `uploads/`.

**Tech Stack:** React 19, Vite, TanStack Query, TanStack Router, Ant Design, Node.js CommonJS scripts, Playwright/Chromium, Vitest, `node:test`

**Source Specs:** `docs/superpowers/specs/1flowse/2026-04-13-style-boundary-runtime-regression-design.md`, `DESIGN.md`, `.agents/skills/frontend-development/SKILL.md`, `.agents/skills/qa-evaluation/SKILL.md`

**Approval:** User approved moving from the design spec to an implementation plan on `2026-04-13 14`.

---

## Scope Split

This work stays in one plan because the tool is only useful if the harness, manifest, browser runner, and QA/skill handoff land together.

1. Build a reusable frontend host that can render isolated style-boundary scenes.
2. Seed the first component and page scenes plus explicit file-to-scene mappings.
3. Add a root browser runner that can execute `component`, `page`, `file`, and `all-pages` modes.
4. Wire the new command into the frontend/QA documentation so developers and QA use it consistently.

## File Structure

**Create**
- `web/app/style-boundary.html`
- `web/app/src/app/AppProviders.tsx`
- `web/app/src/style-boundary/types.ts`
- `web/app/src/style-boundary/window.d.ts`
- `web/app/src/style-boundary/scenario-manifest.json`
- `web/app/src/style-boundary/registry.tsx`
- `web/app/src/style-boundary/main.tsx`
- `web/app/src/style-boundary/_tests/registry.test.tsx`
- `scripts/node/check-style-boundary.js`
- `scripts/node/check-style-boundary/core.js`
- `scripts/node/check-style-boundary/_tests/core.test.js`

**Modify**
- `web/app/src/app/App.tsx`
- `web/app/src/app/router.tsx`
- `web/package.json`
- `web/pnpm-lock.yaml`
- `.agents/skills/frontend-development/SKILL.md`
- `.agents/skills/frontend-development/references/review-checklist.md`
- `.agents/skills/qa-evaluation/SKILL.md`
- `.agents/skills/qa-evaluation/references/frontend-quality-gates.md`

**Notes**
- Keep the runtime harness isolated under `web/app/src/style-boundary/`; do not mount it into product navigation.
- Use a JSON manifest for scene metadata so the root Node script can resolve `--file` targets without trying to execute TypeScript from `web/app/src`.
- Reuse the existing `scripts/node/dev-up.js ensure --frontend-only --skip-docker` flow instead of inventing a second frontend dev-server manager.
- Load Playwright from the `web` workspace with `createRequire(<repo>/web/package.json)` so the root script does not assume a repository-root `node_modules`.
- Failure screenshots must go under `uploads/style-boundary/` because the user requested all visual artifacts live under `uploads/`.

### Task 1: Build The Shared App Host And Style-Boundary Harness

**Files:**
- Create: `web/app/style-boundary.html`
- Create: `web/app/src/app/AppProviders.tsx`
- Create: `web/app/src/style-boundary/types.ts`
- Create: `web/app/src/style-boundary/window.d.ts`
- Create: `web/app/src/style-boundary/scenario-manifest.json`
- Create: `web/app/src/style-boundary/registry.tsx`
- Create: `web/app/src/style-boundary/main.tsx`
- Create: `web/app/src/style-boundary/_tests/registry.test.tsx`
- Modify: `web/app/src/app/App.tsx`
- Modify: `web/app/src/app/router.tsx`

- [ ] **Step 1: Write the failing Vitest coverage for the new harness**

Create `web/app/src/style-boundary/_tests/registry.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { AppProviders } from '../../app/AppProviders';
import { StyleBoundaryHarness } from '../main';
import { getRuntimeScene } from '../registry';

describe('style boundary harness', () => {
  test('renders the account popup component scene and exposes scene metadata on window', async () => {
    const scene = getRuntimeScene('component.account-popup');

    render(
      <AppProviders>
        <StyleBoundaryHarness scene={scene} />
      </AppProviders>
    );

    expect(await screen.findByText('Profile')).toBeInTheDocument();
    expect(window.__STYLE_BOUNDARY__?.scene.id).toBe('component.account-popup');
    expect(window.__STYLE_BOUNDARY__?.ready).toBe(true);
  });

  test('throws when a requested scene id is missing', () => {
    expect(() => getRuntimeScene('component.missing')).toThrow(/Unknown style boundary scene/u);
  });
});
```

- [ ] **Step 2: Run the focused web test and confirm it fails**

Run: `pnpm --dir web --filter @1flowse/web exec vitest run src/style-boundary/_tests/registry.test.tsx`

Expected: FAIL because `AppProviders`, `StyleBoundaryHarness`, and `getRuntimeScene()` do not exist yet.

- [ ] **Step 3: Implement the reusable providers, shell frame export, and initial component harness**

Create `web/app/src/app/AppProviders.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { AppThemeProvider } from '@1flowse/ui';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppThemeProvider>
  );
}
```

Update `web/app/src/app/App.tsx`:

```tsx
import { AppProviders } from './AppProviders';
import { AppRouterProvider } from './router';

export function App() {
  return (
    <AppProviders>
      <AppRouterProvider />
    </AppProviders>
  );
}
```

Update `web/app/src/app/router.tsx` to export the shell wrapper used by both the router and the harness:

```tsx
export function AppShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      title="1Flowse Bootstrap"
      navigation={<AppNavigation />}
      actions={<AppHeaderActions />}
    >
      {children}
    </AppShell>
  );
}

function RootLayout() {
  return (
    <AppShellFrame>
      <Outlet />
    </AppShellFrame>
  );
}
```

Create `web/app/style-boundary.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>1Flowse Style Boundary</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/style-boundary/main.tsx"></script>
  </body>
</html>
```

Create `web/app/src/style-boundary/types.ts`:

```ts
import type { ReactElement } from 'react';

export type StyleBoundarySceneKind = 'component' | 'page' | 'route';

export interface StyleBoundaryAssertion {
  property: string;
  expected: string;
}

export interface StyleBoundaryProbeNode {
  id: string;
  selector: string;
  assertions: StyleBoundaryAssertion[];
}

export interface StyleBoundaryManifestScene {
  id: string;
  kind: StyleBoundarySceneKind;
  title: string;
  files: string[];
  nodes: StyleBoundaryProbeNode[];
}

export interface StyleBoundaryRuntimeScene extends StyleBoundaryManifestScene {
  render: () => ReactElement;
}
```

Create `web/app/src/style-boundary/window.d.ts`:

```ts
import type { StyleBoundaryManifestScene } from './types';

declare global {
  interface Window {
    __STYLE_BOUNDARY__?: {
      ready: boolean;
      scene: StyleBoundaryManifestScene;
    };
  }
}

export {};
```

Create `web/app/src/style-boundary/scenario-manifest.json` with the initial component scene:

```json
[
  {
    "id": "component.account-popup",
    "kind": "component",
    "title": "Account Popup",
    "files": [
      "web/app/src/styles/global.css",
      "web/app/src/app/router.tsx"
    ],
    "nodes": [
      {
        "id": "popup-item",
        "selector": ".app-shell-account-popup .ant-menu-item",
        "assertions": [
          { "property": "display", "expected": "block" }
        ]
      }
    ]
  }
]
```

Create `web/app/src/style-boundary/registry.tsx`:

```tsx
import { Menu } from 'antd';

import manifest from './scenario-manifest.json';
import type { StyleBoundaryManifestScene, StyleBoundaryRuntimeScene } from './types';
import { createAccountMenuItems } from '../app/router';

function getAccountPopupChildren() {
  const items = createAccountMenuItems() ?? [];
  const firstItem = items[0];

  if (
    !firstItem ||
    typeof firstItem !== 'object' ||
    !('children' in firstItem) ||
    !Array.isArray(firstItem.children)
  ) {
    return [];
  }

  return firstItem.children;
}

const renderers: Record<string, StyleBoundaryRuntimeScene['render']> = {
  'component.account-popup': () => (
    <div className="app-shell-account-popup">
      <Menu mode="vertical" selectable={false} items={getAccountPopupChildren()} />
    </div>
  )
};

export function getSceneManifest(): StyleBoundaryManifestScene[] {
  return manifest as StyleBoundaryManifestScene[];
}

export function getRuntimeScene(sceneId: string): StyleBoundaryRuntimeScene {
  const scene = getSceneManifest().find((entry) => entry.id === sceneId);

  if (!scene || !renderers[scene.id]) {
    throw new Error(`Unknown style boundary scene: ${sceneId}`);
  }

  return {
    ...scene,
    render: renderers[scene.id]
  };
}
```

Create `web/app/src/style-boundary/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppProviders } from '../app/AppProviders';
import '../styles/global.css';
import type { StyleBoundaryRuntimeScene } from './types';
import { getRuntimeScene } from './registry';

export function StyleBoundaryHarness({ scene }: { scene: StyleBoundaryRuntimeScene }) {
  window.__STYLE_BOUNDARY__ = {
    ready: true,
    scene
  };

  return scene.render();
}

export function bootstrapStyleBoundary(rootElement: HTMLElement) {
  const params = new URLSearchParams(window.location.search);
  const sceneId = params.get('scene') ?? 'component.account-popup';
  const scene = getRuntimeScene(sceneId);

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppProviders>
        <StyleBoundaryHarness scene={scene} />
      </AppProviders>
    </React.StrictMode>
  );
}

const rootElement = document.getElementById('root');

if (rootElement) {
  bootstrapStyleBoundary(rootElement);
}
```

- [ ] **Step 4: Re-run the focused web test and confirm it passes**

Run: `pnpm --dir web --filter @1flowse/web exec vitest run src/style-boundary/_tests/registry.test.tsx`

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit the host bootstrap**

```bash
git add web/app/style-boundary.html \
  web/app/src/app/App.tsx \
  web/app/src/app/AppProviders.tsx \
  web/app/src/app/router.tsx \
  web/app/src/style-boundary
git commit -m "feat: add style boundary harness host"
```

### Task 2: Seed Page Scenes And Explicit File-To-Scene Coverage

**Files:**
- Modify: `web/app/src/style-boundary/scenario-manifest.json`
- Modify: `web/app/src/style-boundary/registry.tsx`
- Modify: `web/app/src/style-boundary/main.tsx`
- Modify: `web/app/src/style-boundary/_tests/registry.test.tsx`

- [ ] **Step 1: Extend the failing tests to cover page scenes and file mappings**

Update `web/app/src/style-boundary/_tests/registry.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { AppProviders } from '../../app/AppProviders';
import { StyleBoundaryHarness } from '../main';
import { getRuntimeScene, getSceneIdsForFiles } from '../registry';

describe('style boundary registry', () => {
  test('maps changed files to explicitly declared scenes', () => {
    expect(getSceneIdsForFiles(['web/app/src/features/home/HomePage.tsx'])).toEqual(['page.home']);
    expect(getSceneIdsForFiles(['web/app/src/styles/global.css'])).toEqual([
      'component.account-popup',
      'component.account-trigger',
      'page.home',
      'page.embedded-apps',
      'page.agent-flow'
    ]);
  });

  test('renders the home page scene inside the shared shell frame', async () => {
    const scene = getRuntimeScene('page.home');

    render(
      <AppProviders>
        <StyleBoundaryHarness scene={scene} />
      </AppProviders>
    );

    expect(await screen.findByText('1Flowse Bootstrap')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the same focused test and confirm failure**

Run: `pnpm --dir web --filter @1flowse/web exec vitest run src/style-boundary/_tests/registry.test.tsx`

Expected: FAIL because `getSceneIdsForFiles()` does not exist and the page scenes are not yet registered.

- [ ] **Step 3: Add the initial component/page scene set and affected-file mapping**

Update `web/app/src/style-boundary/scenario-manifest.json`:

```json
[
  {
    "id": "component.account-popup",
    "kind": "component",
    "title": "Account Popup",
    "files": [
      "web/app/src/styles/global.css",
      "web/app/src/app/router.tsx"
    ],
    "nodes": [
      {
        "id": "popup-item",
        "selector": ".app-shell-account-popup .ant-menu-item",
        "assertions": [
          { "property": "display", "expected": "block" }
        ]
      }
    ]
  },
  {
    "id": "component.account-trigger",
    "kind": "component",
    "title": "Account Trigger",
    "files": [
      "web/app/src/styles/global.css",
      "web/app/src/app/router.tsx"
    ],
    "nodes": [
      {
        "id": "submenu-title",
        "selector": ".app-shell-account-menu .ant-menu-submenu-title",
        "assertions": [
          { "property": "display", "expected": "flex" }
        ]
      }
    ]
  },
  {
    "id": "page.home",
    "kind": "page",
    "title": "Home Page",
    "files": [
      "web/app/src/styles/global.css",
      "web/app/src/features/home/HomePage.tsx",
      "web/app/src/app/router.tsx"
    ],
    "nodes": [
      {
        "id": "shell-header",
        "selector": ".app-shell-header",
        "assertions": [
          { "property": "display", "expected": "flex" }
        ]
      }
    ]
  },
  {
    "id": "page.embedded-apps",
    "kind": "page",
    "title": "Embedded Apps Page",
    "files": [
      "web/app/src/styles/global.css",
      "web/app/src/features/embedded-apps/EmbeddedAppsPage.tsx",
      "web/app/src/app/router.tsx"
    ],
    "nodes": [
      {
        "id": "shell-header",
        "selector": ".app-shell-header",
        "assertions": [
          { "property": "display", "expected": "flex" }
        ]
      }
    ]
  },
  {
    "id": "page.agent-flow",
    "kind": "page",
    "title": "Agent Flow Page",
    "files": [
      "web/app/src/styles/global.css",
      "web/app/src/features/agent-flow/AgentFlowPage.tsx",
      "web/app/src/app/router.tsx"
    ],
    "nodes": [
      {
        "id": "shell-header",
        "selector": ".app-shell-header",
        "assertions": [
          { "property": "display", "expected": "flex" }
        ]
      }
    ]
  }
]
```

Update `web/app/src/style-boundary/registry.tsx`:

```tsx
import { Menu } from 'antd';

import manifest from './scenario-manifest.json';
import type { StyleBoundaryManifestScene, StyleBoundaryRuntimeScene } from './types';
import { AppShellFrame, createAccountMenuItems } from '../app/router';
import { AgentFlowPage } from '../features/agent-flow/AgentFlowPage';
import { EmbeddedAppsPage } from '../features/embedded-apps/EmbeddedAppsPage';
import { HomePage } from '../features/home/HomePage';

function getAccountPopupChildren() {
  const items = createAccountMenuItems() ?? [];
  const firstItem = items[0];

  if (
    !firstItem ||
    typeof firstItem !== 'object' ||
    !('children' in firstItem) ||
    !Array.isArray(firstItem.children)
  ) {
    return [];
  }

  return firstItem.children;
}

const renderers: Record<string, StyleBoundaryRuntimeScene['render']> = {
  'component.account-popup': () => (
    <div className="app-shell-account-popup">
      <Menu mode="vertical" selectable={false} items={getAccountPopupChildren()} />
    </div>
  ),
  'component.account-trigger': () => (
    <Menu
      className="app-shell-account-menu"
      mode="horizontal"
      selectable={false}
      items={createAccountMenuItems()}
      openKeys={['account']}
    />
  ),
  'page.home': () => (
    <AppShellFrame>
      <HomePage />
    </AppShellFrame>
  ),
  'page.embedded-apps': () => (
    <AppShellFrame>
      <EmbeddedAppsPage />
    </AppShellFrame>
  ),
  'page.agent-flow': () => (
    <AppShellFrame>
      <AgentFlowPage />
    </AppShellFrame>
  )
};

export function getSceneManifest(): StyleBoundaryManifestScene[] {
  return manifest as StyleBoundaryManifestScene[];
}

export function getSceneIdsForFiles(files: string[]): string[] {
  const fileSet = new Set(files);

  return getSceneManifest()
    .filter((scene) => scene.files.some((file) => fileSet.has(file)))
    .map((scene) => scene.id);
}

export function getRuntimeScene(sceneId: string): StyleBoundaryRuntimeScene {
  const scene = getSceneManifest().find((entry) => entry.id === sceneId);

  if (!scene || !renderers[scene.id]) {
    throw new Error(`Unknown style boundary scene: ${sceneId}`);
  }

  return {
    ...scene,
    render: renderers[scene.id]
  };
}
```

Update `web/app/src/style-boundary/main.tsx` so the harness marks the root node and scene ID for the browser runner:

```tsx
export function StyleBoundaryHarness({ scene }: { scene: StyleBoundaryRuntimeScene }) {
  window.__STYLE_BOUNDARY__ = {
    ready: true,
    scene
  };

  return <div data-style-boundary-scene={scene.id}>{scene.render()}</div>;
}
```

- [ ] **Step 4: Re-run the focused web tests and confirm the scene registry passes**

Run: `pnpm --dir web --filter @1flowse/web exec vitest run src/style-boundary/_tests/registry.test.tsx`

Expected: PASS with the account popup and home page scene checks both green.

- [ ] **Step 5: Commit the initial scene coverage**

```bash
git add web/app/src/style-boundary
git commit -m "feat: seed style boundary scenes"
```

### Task 3: Add The Root Browser Runner And CLI Target Resolution

**Files:**
- Create: `scripts/node/check-style-boundary.js`
- Create: `scripts/node/check-style-boundary/core.js`
- Create: `scripts/node/check-style-boundary/_tests/core.test.js`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`

- [ ] **Step 1: Write the failing Node tests for CLI parsing and file-target resolution**

Create `scripts/node/check-style-boundary/_tests/core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { createProbeUrl, parseCliArgs, resolveSceneIds } = require('../core.js');

test('parseCliArgs supports component, page, file, and all-pages modes', () => {
  assert.deepEqual(parseCliArgs(['component', 'component.account-popup']), {
    mode: 'component',
    target: 'component.account-popup',
    help: false,
  });
  assert.deepEqual(parseCliArgs(['page', 'page.home']), {
    mode: 'page',
    target: 'page.home',
    help: false,
  });
  assert.deepEqual(parseCliArgs(['file', 'web/app/src/styles/global.css']), {
    mode: 'file',
    target: 'web/app/src/styles/global.css',
    help: false,
  });
  assert.deepEqual(parseCliArgs(['all-pages']), {
    mode: 'all-pages',
    target: null,
    help: false,
  });
});

test('resolveSceneIds expands explicit file mappings and errors on missing coverage', () => {
  const manifest = [
    { id: 'component.account-popup', kind: 'component', files: ['web/app/src/styles/global.css'] },
    { id: 'page.home', kind: 'page', files: ['web/app/src/styles/global.css', 'web/app/src/features/home/HomePage.tsx'] },
  ];

  assert.deepEqual(resolveSceneIds(manifest, { mode: 'file', target: 'web/app/src/features/home/HomePage.tsx' }), ['page.home']);
  assert.throws(
    () => resolveSceneIds(manifest, { mode: 'file', target: 'web/app/src/features/unknown/Missing.tsx' }),
    /No style boundary scenes declare coverage/u
  );
});

test('createProbeUrl targets the dedicated Vite entry', () => {
  assert.equal(
    createProbeUrl('http://127.0.0.1:3100', 'page.home'),
    'http://127.0.0.1:3100/style-boundary.html?scene=page.home'
  );
});
```

- [ ] **Step 2: Run the focused Node test and confirm failure**

Run: `node --test scripts/node/check-style-boundary/_tests/core.test.js`

Expected: FAIL because the new CLI entry points do not exist.

- [ ] **Step 3: Install Playwright in `web` and implement the root browser runner**

Add the browser dependency:

Run: `pnpm --dir web add -D playwright`

Expected: `web/package.json` and `web/pnpm-lock.yaml` update with the new dev dependency.

Create `scripts/node/check-style-boundary.js`:

```js
#!/usr/bin/env node

const { main } = require('./check-style-boundary/core.js');

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`[1flowse-style-boundary] ${error.message}\n`);
  process.exitCode = 1;
});
```

Create `scripts/node/check-style-boundary/core.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const MODES = new Set(['component', 'page', 'file', 'all-pages']);

function getRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function parseCliArgs(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    return { mode: 'all-pages', target: null, help: true };
  }

  const [mode, target = null] = argv;

  if (!MODES.has(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  if (mode !== 'all-pages' && !target) {
    throw new Error(`Mode ${mode} requires a target`);
  }

  return {
    mode,
    target,
    help: false,
  };
}

function usage() {
  process.stdout.write(`用法：node scripts/node/check-style-boundary.js <component|page|file|all-pages> [target]

示例：
  node scripts/node/check-style-boundary.js component component.account-popup
  node scripts/node/check-style-boundary.js page page.home
  node scripts/node/check-style-boundary.js file web/app/src/styles/global.css
  node scripts/node/check-style-boundary.js all-pages
`);
}

function loadManifest(repoRoot) {
  const manifestPath = path.join(
    repoRoot,
    'web',
    'app',
    'src',
    'style-boundary',
    'scenario-manifest.json'
  );

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function resolveSceneIds(manifest, options) {
  switch (options.mode) {
    case 'component':
    case 'page':
      return [options.target];
    case 'all-pages':
      return manifest.filter((scene) => scene.kind === 'page').map((scene) => scene.id);
    case 'file': {
      const matched = manifest
        .filter((scene) => scene.files.includes(options.target))
        .map((scene) => scene.id);

      if (matched.length === 0) {
        throw new Error(`No style boundary scenes declare coverage for ${options.target}`);
      }

      return matched;
    }
    default:
      throw new Error(`Unsupported mode: ${options.mode}`);
  }
}

function createProbeUrl(baseUrl, sceneId) {
  return `${baseUrl}/style-boundary.html?scene=${encodeURIComponent(sceneId)}`;
}

async function ensureFrontendHost(repoRoot) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(repoRoot, 'scripts', 'node', 'dev-up.js'), 'ensure', '--frontend-only', '--skip-docker'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
      }
    );

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`dev-up ensure failed with exit code ${code}`));
    });
  });
}

function loadPlaywright(repoRoot) {
  const webRequire = createRequire(path.join(repoRoot, 'web', 'package.json'));
  return webRequire('playwright');
}

async function collectNodeResult(page, cdp, styleSheets, node) {
  const locator = page.locator(node.selector).first();
  await locator.waitFor();

  await locator.evaluate((element) => {
    element.setAttribute('data-style-boundary-probe', 'active');
  });

  const actual = await locator.evaluate((element, assertions) => {
    const styles = window.getComputedStyle(element);
    return Object.fromEntries(
      assertions.map((assertion) => [assertion.property, styles.getPropertyValue(assertion.property)])
    );
  }, node.assertions);

  const { root } = await cdp.send('DOM.getDocument', {});
  const nodeId = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '[data-style-boundary-probe="active"]',
  });
  const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId: nodeId.nodeId });

  await locator.evaluate((element) => {
    element.removeAttribute('data-style-boundary-probe');
  });

  return {
    node,
    actual,
    matchedRules: (matched.matchedCSSRules || []).map((ruleMatch) => ({
      selector: ruleMatch.rule.selectorList.text,
      origin: ruleMatch.rule.origin,
      sourceUrl:
        styleSheets.get(ruleMatch.rule.style.styleSheetId) || 'inline',
    })),
  };
}

function collectViolations(results) {
  return results.flatMap((result) =>
    result.node.assertions
      .filter((assertion) => result.actual[assertion.property] !== assertion.expected)
      .map((assertion) => ({
        nodeId: result.node.id,
        selector: result.node.selector,
        property: assertion.property,
        expected: assertion.expected,
        actual: result.actual[assertion.property],
        matchedRules: result.matchedRules,
      }))
  );
}

async function runScene(browser, baseUrl, scene) {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  const styleSheets = new Map();

  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  cdp.on('CSS.styleSheetAdded', (event) => {
    styleSheets.set(event.header.styleSheetId, event.header.sourceURL || 'inline');
  });
  await page.goto(createProbeUrl(baseUrl, scene.id), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__STYLE_BOUNDARY__?.ready === true);

  const nodeResults = [];

  for (const node of scene.nodes) {
    nodeResults.push(await collectNodeResult(page, cdp, styleSheets, node));
  }

  const violations = collectViolations(nodeResults);

  return {
    page,
    scene,
    violations,
  };
}

function ensureUploadsDir(repoRoot) {
  const uploadsDir = path.join(repoRoot, 'uploads', 'style-boundary');
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

async function main(argv) {
  const options = parseCliArgs(argv);

  if (options.help) {
    usage();
    return;
  }

  const repoRoot = getRepoRoot();
  const manifest = loadManifest(repoRoot);
  const sceneIds = resolveSceneIds(manifest, options);
  const uploadsDir = ensureUploadsDir(repoRoot);

  await ensureFrontendHost(repoRoot);

  const { chromium } = loadPlaywright(repoRoot);
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  try {
    for (const sceneId of sceneIds) {
      const scene = manifest.find((entry) => entry.id === sceneId);
      const result = await runScene(browser, 'http://127.0.0.1:3100', scene);

      if (result.violations.length > 0) {
        const screenshotPath = path.join(uploadsDir, `${scene.id}.png`);
        await result.page.screenshot({ path: screenshotPath, fullPage: true });
        throw new Error(
          `${scene.id} failed: ${result.violations
            .map(
              (violation) =>
                `${violation.nodeId}.${violation.property} expected=${violation.expected} actual=${violation.actual} source=${violation.matchedRules
                  .map((rule) => `${rule.sourceUrl}::${rule.selector}`)
                  .join('|')}`
            )
            .join(', ')}`
        );
      }

      process.stdout.write(`[1flowse-style-boundary] PASS ${scene.id}\n`);
      await result.page.close();
    }
  } finally {
    await browser.close();
  }
}

module.exports = {
  createProbeUrl,
  main,
  parseCliArgs,
  resolveSceneIds,
};
```

- [ ] **Step 4: Run the Node test and the first browser smoke checks**

Run: `node --test scripts/node/check-style-boundary/_tests/core.test.js`

Expected: PASS with `3 tests` green.

Run: `node scripts/node/check-style-boundary.js component component.account-popup`

Expected: PASS and output `PASS component.account-popup`.

Run: `node scripts/node/check-style-boundary.js page page.home`

Expected: PASS and output `PASS page.home`.

- [ ] **Step 5: Commit the CLI and browser runner**

```bash
git add scripts/node/check-style-boundary.js \
  scripts/node/check-style-boundary \
  web/package.json \
  web/pnpm-lock.yaml
git commit -m "feat: add style boundary browser runner"
```

### Task 4: Wire The Runtime Command Into Frontend And QA Gates

**Files:**
- Modify: `.agents/skills/frontend-development/SKILL.md`
- Modify: `.agents/skills/frontend-development/references/review-checklist.md`
- Modify: `.agents/skills/qa-evaluation/SKILL.md`
- Modify: `.agents/skills/qa-evaluation/references/frontend-quality-gates.md`

- [ ] **Step 1: Update the frontend and QA guidance to require the new runtime regression command**

Update `.agents/skills/frontend-development/SKILL.md` Quick Reference:

```md
- 共享样式、导航、菜单、壳层或第三方 slot 覆写改动后，必须运行 `node scripts/node/check-style-boundary.js ...`
- 新增组件或页面样式回归时，必须同步维护 `web/app/src/style-boundary/scenario-manifest.json`
- `--file` 模式只信任显式声明的场景映射；映射缺失时必须先补场景，再继续开发
```

Update `.agents/skills/frontend-development/references/review-checklist.md`:

```md
- 本次改动是否已经运行 `node scripts/node/check-style-boundary.js component ... / page ... / file ...` 中至少一种合适模式？
- 如果改动影响共享样式或第三方 slot，`web/app/src/style-boundary/scenario-manifest.json` 是否已经补上对应覆盖？
- 失败截图和样式来源证据是否已进入 `uploads/`，而不是只给口头判断？
```

Update `.agents/skills/qa-evaluation/SKILL.md` Quick Reference:

```md
- 评估范围命中前端样式边界时，优先读取 `node scripts/node/check-style-boundary.js ...` 的运行结果
- 没有运行时证据时，前端样式结论默认降级为受限结论
```

Update `.agents/skills/qa-evaluation/references/frontend-quality-gates.md`:

```md
## Gate 5: Runtime Style Regression Evidence

- 导航、共享壳层、全局样式、第三方 slot 覆写改动后，必须至少运行一次 `node scripts/node/check-style-boundary.js component|page|file ...`
- `--file` 模式若提示“覆盖关系未声明”，视为门禁未通过，先补场景映射
- 失败报告必须包含场景 ID、关键节点、样式属性、实际值、命中的 selector，以及 `uploads/` 中的截图
```

- [ ] **Step 2: Run the focused verification commands after the docs land**

Run: `pnpm --dir web --filter @1flowse/web exec vitest run src/style-boundary/_tests/registry.test.tsx`

Expected: PASS.

Run: `node --test scripts/node/check-style-boundary/_tests/core.test.js`

Expected: PASS.

Run: `node scripts/node/check-style-boundary.js file web/app/src/styles/global.css`

Expected: PASS for each declared scene, or a targeted failure report with screenshot if one of the existing assertions is violated.

- [ ] **Step 3: Commit the skill and QA gate updates**

```bash
git add .agents/skills/frontend-development/SKILL.md \
  .agents/skills/frontend-development/references/review-checklist.md \
  .agents/skills/qa-evaluation/SKILL.md \
  .agents/skills/qa-evaluation/references/frontend-quality-gates.md
git commit -m "docs: wire style boundary runtime checks into QA gates"
```

## Final Verification

- [ ] Run: `pnpm --dir web --filter @1flowse/web exec vitest run src/style-boundary/_tests/registry.test.tsx`
- [ ] Run: `node --test scripts/node/check-style-boundary/_tests/core.test.js`
- [ ] Run: `node scripts/node/check-style-boundary.js component component.account-popup`
- [ ] Run: `node scripts/node/check-style-boundary.js page page.home`
- [ ] Run: `node scripts/node/check-style-boundary.js file web/app/src/styles/global.css`

Expected result: all targeted tests pass, the CLI can resolve component/page/file modes, and any runtime failure writes a screenshot to `uploads/style-boundary/`.
