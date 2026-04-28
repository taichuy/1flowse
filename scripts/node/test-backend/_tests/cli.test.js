const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildCommands, main } = require('../../test-backend.js');

test('buildCommands uses independent cargo jobs and cargo test threads', () => {
  assert.deepEqual(buildCommands({ cargoJobs: 4, cargoTestThreads: 2 }), [
    {
      label: 'cargo-test',
      command: 'cargo',
      args: ['test', '--workspace', '--jobs', '4', '--', '--test-threads=2'],
      cwd: 'api',
      env: {
        CARGO_BUILD_JOBS: '4',
        CARGO_INCREMENTAL: '0',
      },
    },
  ]);
});

test('main prints help without running the backend gate', async () => {
  let output = '';
  let ran = false;

  const status = await main(['--help'], {
    writeStdout(text) {
      output += text;
    },
    managedRunnerImpl() {
      ran = true;
      return 0;
    },
  });

  assert.equal(status, 0);
  assert.equal(ran, false);
  assert.match(output, /Usage: node scripts\/node\/test-backend\.js/u);
});

test('main routes backend test execution through the heavy managed gate', async () => {
  let capturedOptions = null;

  const status = await main([], {
    repoRoot: '/repo-root',
    env: {},
    runtimeConfig: {
      backend: {
        cargoJobs: 5,
        cargoTestThreads: 2,
      },
      locks: {
        waitTimeoutMinutes: 30,
        waitTimeoutMs: 30 * 60 * 1000,
        pollIntervalMs: 5000,
      },
    },
    writeStdout() {},
    writeStderr() {},
    managedRunnerImpl(options) {
      capturedOptions = options;
      return 0;
    },
  });

  assert.equal(status, 0);
  assert.equal(capturedOptions.lockMode, 'heavy');
  assert.equal(capturedOptions.scope, 'test-backend');
  assert.equal(capturedOptions.commandDisplay, 'node scripts/node/test-backend.js');
  assert.deepEqual(capturedOptions.commands, buildCommands({ cargoJobs: 5, cargoTestThreads: 2 }));
});

test('main writes advisory warning output under tmp/test-governance', async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oneflowbase-test-backend-'));
  const calls = [];

  const status = await main([], {
    repoRoot,
    env: {},
    runtimeConfig: {
      backend: {
        cargoJobs: 1,
        cargoTestThreads: 1,
      },
      locks: {
        waitTimeoutMinutes: 30,
        waitTimeoutMs: 30 * 60 * 1000,
        pollIntervalMs: 5000,
      },
    },
    writeStdout() {},
    writeStderr() {},
    spawnSyncImpl(command, args, options) {
      calls.push({ command, args, options });

      return {
        status: 0,
        stdout: '',
        stderr: 'warning: cargo test advisory\n',
      };
    },
  });

  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['test', '--workspace', '--jobs', '1', '--', '--test-threads=1']);

  const warningLogPath = path.join(repoRoot, 'tmp', 'test-governance', 'test-backend.warnings.log');
  assert.equal(fs.existsSync(warningLogPath), true);
  assert.match(fs.readFileSync(warningLogPath, 'utf8'), /warning: cargo test advisory/u);
});
