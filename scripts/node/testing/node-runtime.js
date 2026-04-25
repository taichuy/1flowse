const fs = require('node:fs');
const path = require('node:path');

function listPathEntries(env = process.env) {
  return (env.PATH ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolvePnpmExecutableNames() {
  if (process.platform === 'win32') {
    return ['pnpm.cmd', 'pnpm.exe', 'pnpm'];
  }

  return ['pnpm'];
}

function resolveNodeExecutableName() {
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function resolvePnpmBinaryFromPath(env = process.env) {
  for (const entry of listPathEntries(env)) {
    for (const pnpmFileName of resolvePnpmExecutableNames()) {
      const pnpmPath = path.join(entry, pnpmFileName);
      if (!fs.existsSync(pnpmPath)) {
        continue;
      }

      return fs.realpathSync(pnpmPath);
    }
  }

  return null;
}

function resolveNodeBinaryFromPath(env = process.env) {
  const nodeFileName = resolveNodeExecutableName();
  const pnpmBinary = resolvePnpmBinaryFromPath(env);

  // 优先复用 pnpm 同目录的真实 Node，避免 PATH 里的 bun-node wrapper 吞掉退出码。
  if (pnpmBinary) {
    const candidateNodePath = path.join(path.dirname(pnpmBinary), nodeFileName);
    if (fs.existsSync(candidateNodePath)) {
      return fs.realpathSync(candidateNodePath);
    }
  }

  return process.execPath;
}

function buildNodePreferredEnv(env = process.env) {
  const nodeBinary = resolveNodeBinaryFromPath(env);
  const pnpmBinary = resolvePnpmBinaryFromPath(env);
  const nodeDir = path.dirname(nodeBinary);
  const nextPathEntries = [
    nodeDir,
    ...listPathEntries(env).filter((entry) => entry !== nodeDir),
  ];

  return {
    nodeBinary,
    env: {
      ...env,
      PATH: nextPathEntries.join(path.delimiter),
      ...(pnpmBinary ? { npm_execpath: pnpmBinary } : {}),
      npm_node_execpath: nodeBinary,
      NODE: nodeBinary,
    },
  };
}

module.exports = {
  resolvePnpmBinaryFromPath,
  resolveNodeBinaryFromPath,
  buildNodePreferredEnv,
};
