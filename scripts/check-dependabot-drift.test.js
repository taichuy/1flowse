const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildMarkdownSummary,
  buildWorkspaceManifestCoverage,
  buildWorkspaceManifestInventory,
  evaluateAlert,
} = require('./check-dependabot-drift.js');

function createFixtureRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependabot-drift-'));

  fs.mkdirSync(path.join(repoRoot, 'web'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'web', 'package.json'),
    JSON.stringify(
      {
        dependencies: {
          next: '^15.5.14',
        },
        pnpm: {
          overrides: {
            flatted: '3.4.2',
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  fs.writeFileSync(
    path.join(repoRoot, 'web', 'pnpm-lock.yaml'),
    ['packages:', '  next@15.5.14:', '  flatted@3.4.2:'].join('\n'),
    'utf8',
  );

  fs.mkdirSync(path.join(repoRoot, 'api'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'api', 'pyproject.toml'),
    [
      '[project]',
      'dependencies = [',
      '  "cryptography>=46.0.5,<47",',
      '  "httpx>=0.28.0,<1",',
      ']',
      '',
      '[project.optional-dependencies]',
      'dev = [',
      '  "pytest>=8.3.0,<9",',
      ']',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(repoRoot, 'api', 'uv.lock'),
    [
      'version = 1',
      '',
      '[[package]]',
      'name = "cryptography"',
      'version = "46.0.5"',
      '',
      '[[package]]',
      'name = "httpx"',
      'version = "0.28.1"',
    ].join('\n'),
    'utf8',
  );

  return repoRoot;
}

test('buildWorkspaceManifestInventory groups pnpm and uv roots', () => {
  const inventory = buildWorkspaceManifestInventory([
    'api/pyproject.toml',
    'api/uv.lock',
    'web/package.json',
    'web/pnpm-lock.yaml',
  ]);

  assert.deepEqual(
    inventory.map((item) => ({
      rootLabel: item.rootLabel,
      ecosystem: item.ecosystem,
      manifestPath: item.manifestPath,
      lockfilePath: item.lockfilePath,
    })),
    [
      {
        rootLabel: 'api',
        ecosystem: 'uv',
        manifestPath: 'api/pyproject.toml',
        lockfilePath: 'api/uv.lock',
      },
      {
        rootLabel: 'web',
        ecosystem: 'pnpm',
        manifestPath: 'web/package.json',
        lockfilePath: 'web/pnpm-lock.yaml',
      },
    ],
  );
});

test('evaluateAlert resolves pnpm and uv manifests via sibling lockfiles', () => {
  const repoRoot = createFixtureRepo();
  const inventory = buildWorkspaceManifestInventory([
    'api/pyproject.toml',
    'api/uv.lock',
    'web/package.json',
    'web/pnpm-lock.yaml',
  ]);

  const pythonAlert = {
    dependency: {
      manifest_path: 'api/pyproject.toml',
      package: {
        name: 'cryptography',
      },
    },
    security_vulnerability: {
      first_patched_version: {
        identifier: '46.0.5',
      },
    },
  };
  const nodeAlert = {
    dependency: {
      manifest_path: 'web/package.json',
      package: {
        name: 'next',
      },
    },
    security_vulnerability: {
      first_patched_version: {
        identifier: '15.5.14',
      },
    },
  };

  const pythonResult = evaluateAlert(pythonAlert, {
    baseRepoRoot: repoRoot,
    workspaceManifestInventory: inventory,
  });
  const nodeResult = evaluateAlert(nodeAlert, {
    baseRepoRoot: repoRoot,
    workspaceManifestInventory: inventory,
  });

  assert.equal(pythonResult.state, 'patched-locally');
  assert.deepEqual(pythonResult.localVersions, ['46.0.5']);
  assert.deepEqual(pythonResult.specifiers, ['cryptography>=46.0.5,<47']);
  assert.equal(pythonResult.specifierSourcePath, 'api/pyproject.toml');

  assert.equal(nodeResult.state, 'patched-locally');
  assert.deepEqual(nodeResult.localVersions, ['15.5.14']);
  assert.deepEqual(nodeResult.specifiers, ['^15.5.14']);
  assert.equal(nodeResult.specifierSourcePath, 'web/package.json');
});

test('evaluateAlert also resolves alerts reported on lockfile paths', () => {
  const repoRoot = createFixtureRepo();
  const inventory = buildWorkspaceManifestInventory([
    'api/pyproject.toml',
    'api/uv.lock',
    'web/package.json',
    'web/pnpm-lock.yaml',
  ]);

  const pythonAlert = {
    dependency: {
      manifest_path: 'api/uv.lock',
      package: {
        name: 'cryptography',
      },
    },
    security_vulnerability: {
      first_patched_version: {
        identifier: '46.0.5',
      },
    },
  };
  const nodeAlert = {
    dependency: {
      manifest_path: 'web/pnpm-lock.yaml',
      package: {
        name: 'flatted',
      },
    },
    security_vulnerability: {
      first_patched_version: {
        identifier: '3.4.2',
      },
    },
  };

  const pythonResult = evaluateAlert(pythonAlert, {
    baseRepoRoot: repoRoot,
    workspaceManifestInventory: inventory,
  });
  const nodeResult = evaluateAlert(nodeAlert, {
    baseRepoRoot: repoRoot,
    workspaceManifestInventory: inventory,
  });

  assert.equal(pythonResult.state, 'patched-locally');
  assert.deepEqual(pythonResult.localVersions, ['46.0.5']);
  assert.deepEqual(pythonResult.specifiers, ['cryptography>=46.0.5,<47']);
  assert.equal(pythonResult.specifierSourcePath, 'api/pyproject.toml');

  assert.equal(nodeResult.state, 'patched-locally');
  assert.deepEqual(nodeResult.localVersions, ['3.4.2']);
  assert.deepEqual(nodeResult.specifiers, ['3.4.2']);
  assert.equal(nodeResult.specifierSourcePath, 'web/package.json');
});

test('buildMarkdownSummary highlights local roots missing from dependency graph', () => {
  const inventory = buildWorkspaceManifestInventory([
    'api/pyproject.toml',
    'api/uv.lock',
    'services/compat-dify/pyproject.toml',
    'services/compat-dify/uv.lock',
    'web/package.json',
    'web/pnpm-lock.yaml',
  ]);
  const manifestCoverage = buildWorkspaceManifestCoverage(inventory, []);
  const summary = buildMarkdownSummary({
    repository: {
      owner: 'taichuy',
      repo: '7flows',
    },
    defaultBranch: 'taichuy_dev',
    manifestNodes: [],
    workspaceManifestInventory: inventory,
    manifestCoverage,
    openAlerts: [],
    results: [],
    actionableAlerts: [],
  });

  assert.match(summary, /本地 manifest roots：`3`/);
  assert.match(summary, /graph coverage 缺口：`api`（uv）；`services\/compat-dify`（uv）；`web`（pnpm）/);
});
