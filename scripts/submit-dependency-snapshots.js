const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  buildWorkspaceManifestInventory,
  collectTrackedFiles,
  normalizePythonPackageName,
} = require('./check-dependabot-drift');

const repoRoot = path.resolve(__dirname, '..');
const detectorName = '7flows-dependency-submission';
const detectorVersion = '0.2.0';
const developmentOptionalDependencyGroups = new Set(['ci', 'dev', 'docs', 'lint', 'test', 'tests']);

function run(command, args, baseRepoRoot = repoRoot) {
  return execFileSync(command, args, {
    cwd: baseRepoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseRemoteRepository(remoteUrl) {
  const sshMatch = remoteUrl.match(/^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  const httpsMatch = remoteUrl.match(/^https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  throw new Error(`无法解析 remote.origin.url: ${remoteUrl}`);
}

function resolveRepository() {
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    if (owner && repo) {
      return { owner, repo };
    }
  }

  return parseRemoteRepository(run('git', ['remote', 'get-url', 'origin']));
}

function resolveSha() {
  return process.env.GITHUB_SHA || run('git', ['rev-parse', 'HEAD']);
}

function resolveRef() {
  if (process.env.GITHUB_REF) {
    return process.env.GITHUB_REF;
  }

  const branch = run('git', ['branch', '--show-current']);
  if (!branch) {
    throw new Error('无法解析当前 ref，请在 GitHub Actions 中运行或设置 GITHUB_REF。');
  }

  return `refs/heads/${branch}`;
}

function encodeNpmPackageName(packageName) {
  return packageName.startsWith('@') ? `%40${packageName.slice(1)}` : packageName;
}

function buildNpmPackageUrl(packageName, version) {
  return `pkg:/npm/${encodeNpmPackageName(packageName)}@${version}`;
}

function buildPythonPackageUrl(packageName, version) {
  return `pkg:pypi/${normalizePythonPackageName(packageName)}@${version}`;
}

function buildDependencyKey(packageName, version) {
  return `${packageName}@${version}`;
}

function collectInlineTableDependencyNames(blockText) {
  return [...String(blockText || '').matchAll(/\{\s*name\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
}

function extractArrayBody(blockText, key) {
  const pattern = new RegExp(`^${key}\\s*=\\s*\\[([\\s\\S]*?)^\\]`, 'm');
  const match = String(blockText || '').match(pattern);
  return match ? match[1] : '';
}

function parseUvOptionalDependencyGroups(blockText) {
  const groups = new Map();
  const lines = String(blockText || '').replace(/\r\n/g, '\n').split('\n');
  let insideOptionalDependencies = false;
  let currentGroup = null;
  let currentBody = '';

  function flushGroup() {
    if (!currentGroup) {
      return;
    }
    groups.set(currentGroup, collectInlineTableDependencyNames(currentBody));
    currentGroup = null;
    currentBody = '';
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!insideOptionalDependencies) {
      if (trimmedLine === '[package.optional-dependencies]') {
        insideOptionalDependencies = true;
      }
      return;
    }

    if (!trimmedLine) {
      return;
    }

    if (trimmedLine.startsWith('[')) {
      flushGroup();
      insideOptionalDependencies = false;
      return;
    }

    const groupMatch = trimmedLine.match(/^([A-Za-z0-9_.-]+)\s*=\s*\[(.*)$/);
    if (groupMatch) {
      flushGroup();
      currentGroup = groupMatch[1];
      currentBody = groupMatch[2];
      if (trimmedLine.includes(']')) {
        flushGroup();
      }
      return;
    }

    if (!currentGroup) {
      return;
    }

    currentBody = `${currentBody}\n${trimmedLine}`;
    if (trimmedLine.includes(']')) {
      flushGroup();
    }
  });

  flushGroup();
  return groups;
}

function parseUvLockPackages(lockfileText) {
  const blocks = String(lockfileText || '')
    .replace(/\r\n/g, '\n')
    .split('\n[[package]]\n')
    .map((block, index) => (index === 0 ? block.replace(/^\[\[package\]\]\n/, '') : block))
    .filter((block) => block.includes('name = '));

  const packages = new Map();
  let editableRoot = null;

  blocks.forEach((block) => {
    const nameMatch = block.match(/^name = "([^"]+)"$/m);
    const versionMatch = block.match(/^version = "([^"]+)"$/m);

    if (!nameMatch || !versionMatch) {
      return;
    }

    const packageName = nameMatch[1];
    const normalizedName = normalizePythonPackageName(packageName);
    const dependencyKey = buildDependencyKey(normalizedName, versionMatch[1]);
    const dependencies = collectInlineTableDependencyNames(extractArrayBody(block, 'dependencies')).map(
      normalizePythonPackageName,
    );
    const optionalDependencies = new Map(
      [...parseUvOptionalDependencyGroups(block).entries()].map(([groupName, dependencyNames]) => [
        groupName,
        dependencyNames.map(normalizePythonPackageName),
      ]),
    );
    const entry = {
      name: packageName,
      normalizedName,
      version: versionMatch[1],
      dependencyKey,
      packageUrl: buildPythonPackageUrl(packageName, versionMatch[1]),
      dependencies,
      optionalDependencies,
      editable: /^source = \{ editable = "\." \}$/m.test(block),
    };

    packages.set(normalizedName, entry);
    if (entry.editable) {
      editableRoot = entry;
    }
  });

  return { packages, editableRoot };
}

function resolveUvOptionalDependencyScope(groupName) {
  return developmentOptionalDependencyGroups.has(String(groupName || '').toLowerCase())
    ? 'development'
    : 'runtime';
}

function registerUvDependency({ packageName, packageMap, scope, relationship, state }) {
  const normalizedName = normalizePythonPackageName(packageName);
  const packageEntry = packageMap.get(normalizedName);

  if (!packageEntry) {
    throw new Error(`uv lock 缺少依赖 ${packageName} 的 package block，无法构建 dependency snapshot。`);
  }

  const childDependencyKeys = packageEntry.dependencies
    .map((childName) =>
      registerUvDependency({
        packageName: childName,
        packageMap,
        scope,
        relationship: 'indirect',
        state,
      }),
    )
    .filter(Boolean);

  upsertResolvedDependency(state, packageEntry.dependencyKey, {
    package_url: packageEntry.packageUrl,
    relationship,
    scope,
    dependencies: [...new Set(childDependencyKeys)].sort(),
  });

  return packageEntry.dependencyKey;
}

function buildUvResolvedDependencies(lockfileText) {
  const { packages, editableRoot } = parseUvLockPackages(lockfileText);
  if (!editableRoot) {
    throw new Error('uv lock 缺少 editable root package，无法识别 direct dependencies。');
  }

  const state = new Map();
  editableRoot.dependencies.forEach((dependencyName) => {
    registerUvDependency({
      packageName: dependencyName,
      packageMap: packages,
      scope: 'runtime',
      relationship: 'direct',
      state,
    });
  });

  editableRoot.optionalDependencies.forEach((dependencyNames, groupName) => {
    const scope = resolveUvOptionalDependencyScope(groupName);
    dependencyNames.forEach((dependencyName) => {
      registerUvDependency({
        packageName: dependencyName,
        packageMap: packages,
        scope,
        relationship: 'direct',
        state,
      });
    });
  });

  return finalizeResolvedDependencies(state);
}

function mergeDependencyScope(currentScope, nextScope) {
  return currentScope === 'runtime' || nextScope === 'runtime' ? 'runtime' : 'development';
}

function mergeDependencyRelationship(currentRelationship, nextRelationship) {
  return currentRelationship === 'direct' || nextRelationship === 'direct' ? 'direct' : 'indirect';
}

function collectDirectDependencyScopes(packageJson) {
  const scopes = new Map();

  Object.keys(packageJson.devDependencies || {}).forEach((dependencyName) => {
    scopes.set(dependencyName, 'development');
  });

  Object.keys(packageJson.optionalDependencies || {}).forEach((dependencyName) => {
    scopes.set(dependencyName, 'runtime');
  });

  Object.keys(packageJson.dependencies || {}).forEach((dependencyName) => {
    scopes.set(dependencyName, 'runtime');
  });

  return scopes;
}

function upsertResolvedDependency(state, dependencyKey, entry) {
  const current = state.get(dependencyKey);
  if (!current) {
    state.set(dependencyKey, {
      package_url: entry.package_url,
      relationship: entry.relationship,
      scope: entry.scope,
      dependencies: [...entry.dependencies],
    });
    return;
  }

  current.relationship = mergeDependencyRelationship(current.relationship, entry.relationship);
  current.scope = mergeDependencyScope(current.scope, entry.scope);
  current.dependencies = [...new Set([...current.dependencies, ...entry.dependencies])].sort();
}

function registerPnpmDependency({ dependencyName, dependencyNode, scope, relationship, state }) {
  if (!dependencyNode || typeof dependencyNode !== 'object') {
    return null;
  }

  if (!dependencyNode.version) {
    throw new Error(`pnpm tree node ${dependencyName} 缺少 version 字段。`);
  }

  const dependencyKey = buildDependencyKey(dependencyName, dependencyNode.version);
  const dependencyEntries = Object.entries(dependencyNode.dependencies || {});
  const childDependencyKeys = dependencyEntries
    .map(([childName, childNode]) =>
      registerPnpmDependency({
        dependencyName: childName,
        dependencyNode: childNode,
        scope,
        relationship: 'indirect',
        state,
      }),
    )
    .filter(Boolean);

  upsertResolvedDependency(state, dependencyKey, {
    package_url: buildNpmPackageUrl(dependencyName, dependencyNode.version),
    relationship,
    scope,
    dependencies: [...new Set(childDependencyKeys)].sort(),
  });

  return dependencyKey;
}

function buildPnpmResolvedDependencies(pnpmListTree, packageJson) {
  if (!pnpmListTree || typeof pnpmListTree !== 'object') {
    throw new Error('pnpm 依赖树为空，无法构建 dependency snapshot。');
  }

  const state = new Map();
  const directScopes = collectDirectDependencyScopes(packageJson);

  Object.entries(pnpmListTree.dependencies || {}).forEach(([dependencyName, dependencyNode]) => {
    registerPnpmDependency({
      dependencyName,
      dependencyNode,
      scope: directScopes.get(dependencyName) || 'runtime',
      relationship: 'direct',
      state,
    });
  });

  return Object.fromEntries(
    [...state.entries()]
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([dependencyKey, entry]) => [dependencyKey, { ...entry, dependencies: [...entry.dependencies].sort() }]),
  );
}

function finalizeResolvedDependencies(state) {
  return Object.fromEntries(
    [...state.entries()]
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([dependencyKey, entry]) => [dependencyKey, { ...entry, dependencies: [...entry.dependencies].sort() }]),
  );
}

function buildScopedPnpmResolvedDependencies(scopedTrees) {
  const state = new Map();

  scopedTrees.forEach(({ tree, scope }) => {
    Object.entries(tree.dependencies || {}).forEach(([dependencyName, dependencyNode]) => {
      registerPnpmDependency({
        dependencyName,
        dependencyNode,
        scope,
        relationship: 'direct',
        state,
      });
    });
  });

  return finalizeResolvedDependencies(state);
}

function loadPnpmDependencyTree(rootDir, dependencySelector) {
  const args = [
    'pnpm',
    '--dir',
    rootDir,
    'list',
    '--json',
    '--depth',
    'Infinity',
    '--lockfile-only',
  ];

  if (dependencySelector === 'runtime') {
    args.push('--prod');
  }

  if (dependencySelector === 'development') {
    args.push('--dev');
  }

  const output = run('corepack', args);

  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0]) {
    throw new Error(`无法解析 ${rootDir} 的 pnpm list 输出。`);
  }

  return parsed[0];
}

function loadScopedPnpmDependencyTrees(rootDir) {
  return {
    runtimeTree: loadPnpmDependencyTree(rootDir, 'runtime'),
    developmentTree: loadPnpmDependencyTree(rootDir, 'development'),
  };
}

function discoverPnpmRoots() {
  return discoverDependencySubmissionRoots().filter((item) => item.ecosystem === 'pnpm');
}

function discoverDependencySubmissionRoots() {
  return buildWorkspaceManifestInventory(collectTrackedFiles()).filter(
    (item) => ['pnpm', 'uv'].includes(item.ecosystem) && item.manifestPath && item.lockfilePath,
  );
}

function loadResolvedDependenciesForRoot(root) {
  if (root.ecosystem === 'pnpm') {
    const packageJson = readJson(path.join(repoRoot, root.manifestPath));
    const { runtimeTree, developmentTree } = loadScopedPnpmDependencyTrees(root.rootDir);
    return {
      resolved: buildScopedPnpmResolvedDependencies([
        { tree: runtimeTree, scope: 'runtime' },
        { tree: developmentTree, scope: 'development' },
      ]),
      metadata: {
        packageJson,
      },
    };
  }

  if (root.ecosystem === 'uv') {
    return {
      resolved: buildUvResolvedDependencies(fs.readFileSync(path.join(repoRoot, root.lockfilePath), 'utf8')),
      metadata: {},
    };
  }

  throw new Error(`暂不支持 ${root.ecosystem} root 的 dependency snapshot。`);
}

function buildRootWarning(root, counters, metadata) {
  if (
    root.ecosystem === 'pnpm' &&
    Object.keys(metadata.packageJson?.devDependencies || {}).length > 0 &&
    counters.developmentCount === 0
  ) {
    return '当前 pnpm lockfile-only snapshot 仍未暴露 development roots；本 workflow 先优先保障 runtime dependency graph 覆盖。';
  }

  return null;
}

function buildSnapshotPayload({ root, resolved, runtimeTree, developmentTree, repository, sha, ref }) {
  const resolvedDependencies =
    resolved ||
    buildScopedPnpmResolvedDependencies([
      { tree: runtimeTree, scope: 'runtime' },
      { tree: developmentTree, scope: 'development' },
    ]);
  const rootLabel = root.rootLabel || root.rootDir || '.';
  const repositoryUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repository.owner}/${repository.repo}`;

  return {
    version: 0,
    sha,
    ref,
    job: {
      correlator: `${detectorName}:${rootLabel}`,
      id: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}:${rootLabel}` : `${Date.now()}:${rootLabel}`,
    },
    detector: {
      name: detectorName,
      version: detectorVersion,
      url: repositoryUrl,
    },
    scanned: new Date().toISOString(),
    manifests: {
      [root.lockfilePath]: {
        name: root.lockfilePath,
        file: {
          source_location: root.lockfilePath,
        },
        resolved: resolvedDependencies,
      },
    },
  };
}

function writeStepSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

function buildSubmissionSummary(items, dryRun) {
  const header = dryRun ? '## Dependency snapshot dry run' : '## Dependency snapshot submission';
  const lines = [header, ''];

  items.forEach((item) => {
    lines.push(`- root: \`${item.rootLabel}\``);
    lines.push(`  - ecosystem: \`${item.ecosystem}\``);
    lines.push(`  - manifest: \`${item.manifestPath}\``);
    lines.push(`  - lockfile: \`${item.lockfilePath}\``);
    lines.push(`  - resolved packages: \`${item.resolvedCount}\``);
    lines.push(`  - direct dependencies: \`${item.directCount}\``);
    lines.push(`  - runtime packages: \`${item.runtimeCount}\``);
    lines.push(`  - development packages: \`${item.developmentCount}\``);
    if (item.snapshotId) {
      lines.push(`  - snapshot id: \`${item.snapshotId}\``);
    }
    if (item.warning) {
      lines.push(`  - warning: ${item.warning}`);
    }
  });

  return lines;
}

async function submitSnapshot(repository, payload, token) {
  const response = await fetch(
    `${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository.owner}/${repository.repo}/dependency-graph/snapshots`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `dependency snapshot 提交失败（HTTP ${response.status}）：${responseBody.message || 'unknown error'}`,
    );
  }

  return responseBody;
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    outputPath: null,
    requestedRoots: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (argument === '--output') {
      const outputPath = argv[index + 1];
      if (!outputPath) {
        throw new Error('--output 需要路径参数。');
      }
      options.outputPath = outputPath;
      index += 1;
      continue;
    }

    if (argument === '--root') {
      const rootDir = argv[index + 1];
      if (!rootDir) {
        throw new Error('--root 需要目录参数。');
      }
      options.requestedRoots.push(rootDir);
      index += 1;
      continue;
    }

    throw new Error(`未知参数: ${argument}`);
  }

  return options;
}

function selectRoots(availableRoots, requestedRoots) {
  if (!requestedRoots || requestedRoots.length === 0) {
    return availableRoots;
  }

  const selectedRoots = requestedRoots.map((requestedRoot) => {
    const matchedRoot = availableRoots.find(
      (item) => item.rootDir === requestedRoot || item.rootLabel === requestedRoot,
    );
    if (!matchedRoot) {
      throw new Error(`未找到 dependency submission root: ${requestedRoot}`);
    }
    return matchedRoot;
  });

  return [...new Map(selectedRoots.map((item) => [item.rootDir, item])).values()];
}

function summarizeResolvedDependencies(resolved) {
  const entries = Object.values(resolved);
  return {
    resolvedCount: entries.length,
    directCount: entries.filter((entry) => entry.relationship === 'direct').length,
    runtimeCount: entries.filter((entry) => entry.scope === 'runtime').length,
    developmentCount: entries.filter((entry) => entry.scope === 'development').length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const roots = selectRoots(discoverDependencySubmissionRoots(), options.requestedRoots);

  if (roots.length === 0) {
    console.log('当前仓库没有可提交的 dependency snapshot roots。');
    return;
  }

  const repository = resolveRepository();
  const sha = resolveSha();
  const ref = resolveRef();
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const summaries = [];
  const outputPayloads = {};

  for (const root of roots) {
    const { resolved, metadata } = loadResolvedDependenciesForRoot(root);
    const payload = buildSnapshotPayload({
      root,
      resolved,
      repository,
      sha,
      ref,
    });
    const manifest = payload.manifests[root.lockfilePath];
    const resolvedDependencies = manifest.resolved;
    const counters = summarizeResolvedDependencies(resolvedDependencies);
    const warning = buildRootWarning(root, counters, metadata);

    if (options.outputPath) {
      outputPayloads[root.rootLabel] = payload;
    }

    if (options.dryRun) {
      console.log(
        `dry-run: 已构建 ${root.rootLabel} dependency snapshot（resolved=${counters.resolvedCount}，direct=${counters.directCount}）。`,
      );
      summaries.push({
        rootLabel: root.rootLabel,
        ecosystem: root.ecosystem,
        manifestPath: root.manifestPath,
        lockfilePath: root.lockfilePath,
        warning,
        ...counters,
      });
      continue;
    }

    if (!token) {
      throw new Error('缺少 GITHUB_TOKEN 或 GH_TOKEN，无法提交 dependency snapshot。');
    }

    const responseBody = await submitSnapshot(repository, payload, token);
    const snapshotId = responseBody.id || responseBody.snapshot_id || 'unknown';
    console.log(
      `已提交 ${root.rootLabel} dependency snapshot（resolved=${counters.resolvedCount}，direct=${counters.directCount}，snapshot=${snapshotId}）。`,
    );
    summaries.push({
      rootLabel: root.rootLabel,
      ecosystem: root.ecosystem,
      manifestPath: root.manifestPath,
      lockfilePath: root.lockfilePath,
      snapshotId,
      warning,
      ...counters,
    });
  }

  if (options.outputPath) {
    const outputPath = path.resolve(repoRoot, options.outputPath);
    const outputValue = roots.length === 1 ? outputPayloads[roots[0].rootLabel] : outputPayloads;
    fs.writeFileSync(outputPath, JSON.stringify(outputValue, null, 2));
  }

  const summaryLines = buildSubmissionSummary(summaries, options.dryRun);
  console.log(summaryLines.join('\n'));
  writeStepSummary(summaryLines);
}

module.exports = {
  buildPnpmResolvedDependencies,
  buildScopedPnpmResolvedDependencies,
  buildSnapshotPayload,
  buildUvResolvedDependencies,
  collectDirectDependencyScopes,
  discoverDependencySubmissionRoots,
  discoverPnpmRoots,
  parseArgs,
  selectRoots,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`执行失败: ${error.message}`);
    process.exit(1);
  });
}
