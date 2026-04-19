#!/usr/bin/env node

const path = require('node:path');

const {
  getRepoRoot,
  runCommandSequence,
} = require('./testing/warning-capture.js');

function buildCommand({ argv, repoRoot }) {
  return {
    label: 'runtime-page-debug',
    command: process.execPath,
    args: [path.join(repoRoot, 'scripts', 'node', 'page-debug.js'), ...argv],
    cwd: repoRoot,
  };
}

function usage() {
  process.stdout.write(`Usage: node scripts/node/runtime-gate.js <page-debug args>\n`);
}

function main(argv = [], deps = {}) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    usage();
    return 0;
  }

  const repoRoot = deps.repoRoot || getRepoRoot();

  return runCommandSequence({
    repoRoot,
    env: deps.env || process.env,
    scope: 'runtime-gate',
    commands: [buildCommand({ argv, repoRoot })],
    spawnSyncImpl: deps.spawnSyncImpl,
    writeStdout: deps.writeStdout,
    writeStderr: deps.writeStderr,
  });
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[1flowbase-runtime-gate] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildCommand,
  main,
};
