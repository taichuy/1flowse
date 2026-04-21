#!/usr/bin/env node
const {
  buildCargoCommandEnv,
  getRepoRoot,
  runManagedCommandSequence,
} = require('./testing/warning-capture.js');
const { loadVerifyRuntimeConfig } = require('./testing/verify-runtime.js');

function buildCommands({ cargoJobs, cargoTestThreads }) {
  return [
    {
      label: 'cargo-fmt',
      command: 'cargo',
      args: ['fmt', '--all', '--check'],
      cwd: 'api',
      env: buildCargoCommandEnv({ cargoParallelism: cargoJobs }),
    },
    {
      label: 'cargo-clippy',
      command: 'cargo',
      args: ['clippy', '--workspace', '--all-targets', '--jobs', String(cargoJobs), '--', '-D', 'warnings'],
      cwd: 'api',
      env: buildCargoCommandEnv({ cargoParallelism: cargoJobs, disableIncremental: true }),
    },
    {
      label: 'cargo-test',
      command: 'cargo',
      args: ['test', '--workspace', '--jobs', String(cargoJobs), '--', `--test-threads=${cargoTestThreads}`],
      cwd: 'api',
      env: buildCargoCommandEnv({ cargoParallelism: cargoJobs, disableIncremental: true }),
    },
    {
      label: 'cargo-check',
      command: 'cargo',
      args: ['check', '--workspace', '--jobs', String(cargoJobs)],
      cwd: 'api',
      env: buildCargoCommandEnv({ cargoParallelism: cargoJobs, disableIncremental: true }),
    },
  ];
}

async function main(_argv = [], deps = {}) {
  const repoRoot = deps.repoRoot || getRepoRoot();
  const env = deps.env || process.env;
  const runtimeConfig = deps.runtimeConfig || loadVerifyRuntimeConfig({ repoRoot, env });
  const managedRunner = deps.managedRunnerImpl || runManagedCommandSequence;

  return managedRunner({
    repoRoot,
    env,
    scope: 'verify-backend',
    lockMode: 'heavy',
    commandDisplay: 'node scripts/node/verify-backend.js',
    runtimeConfig,
    commands: buildCommands({
      cargoJobs: runtimeConfig.backend.cargoJobs,
      cargoTestThreads: runtimeConfig.backend.cargoTestThreads,
    }),
    spawnSyncImpl: deps.spawnSyncImpl,
    writeStdout: deps.writeStdout,
    writeStderr: deps.writeStderr,
  });
}

if (require.main === module) {
  Promise.resolve()
    .then(() => main(process.argv.slice(2)))
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      process.stderr.write(`[1flowbase-verify-backend] ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  buildCommands,
  main,
};
