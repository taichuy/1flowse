#!/usr/bin/env node

const {
  getRepoRoot,
  runCommandSequence,
} = require('./testing/warning-capture.js');

const CONTRACT_TEST_FILES = [
  'src/features/settings/api/_tests/settings-api.test.ts',
  'src/features/settings/_tests/model-providers-page.test.tsx',
  'src/style-boundary/_tests/registry.test.tsx',
  'src/features/agent-flow/_tests/llm-model-provider-field.test.tsx',
];

function buildCommands({ repoRoot }) {
  return [
    {
      label: 'model-provider-contract-tests',
      command: 'pnpm',
      args: ['--dir', 'web/app', 'exec', 'vitest', 'run', ...CONTRACT_TEST_FILES],
      cwd: repoRoot,
    },
  ];
}

function usage(writeStdout = (text) => process.stdout.write(text)) {
  writeStdout(
    'Usage: node scripts/node/test-contracts.js\n'
      + 'Runs targeted model provider contract tests across shared consumers\n'
  );
}

function main(argv = [], deps = {}) {
  if (argv.includes('-h') || argv.includes('--help')) {
    usage(deps.writeStdout);
    return 0;
  }

  const repoRoot = deps.repoRoot || getRepoRoot();

  return runCommandSequence({
    repoRoot,
    env: deps.env || process.env,
    scope: 'test-contracts',
    commands: buildCommands({ repoRoot }),
    spawnSyncImpl: deps.spawnSyncImpl,
    writeStdout: deps.writeStdout,
    writeStderr: deps.writeStderr,
  });
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[1flowbase-test-contracts] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CONTRACT_TEST_FILES,
  buildCommands,
  main,
};
