const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  runCommandSequence,
  runManagedCommandSequence,
} = require('../warning-capture.js');

test('runManagedCommandSequence injects the heavy lock token into child env', async () => {
  const calls = [];

  const status = await runManagedCommandSequence({
    repoRoot: '/repo-root',
    env: {},
    scope: 'verify-backend',
    lockMode: 'heavy',
    commandDisplay: 'node scripts/node/verify-backend.js',
    commands: [{ label: 'cargo-test', command: 'cargo', args: ['test'] }],
    withHeavyVerifyLockImpl: async (_options, run) => run({
      ONEFLOWBASE_VERIFY_LOCK_TOKEN: 'chain-token',
    }),
    runCommandSequenceImpl: (options) => {
      calls.push(options);
      return 0;
    },
  });

  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].env.ONEFLOWBASE_VERIFY_LOCK_TOKEN, 'chain-token');
});

test('runManagedCommandSequence skips the heavy lock wrapper in none mode', async () => {
  let heavyLockCalls = 0;

  const status = await runManagedCommandSequence({
    repoRoot: '/repo-root',
    env: {},
    scope: 'test-backend',
    lockMode: 'none',
    commandDisplay: 'node scripts/node/test-backend.js',
    commands: [{ label: 'cargo-test', command: 'cargo', args: ['test'] }],
    withHeavyVerifyLockImpl: async () => {
      heavyLockCalls += 1;
      return 0;
    },
    runCommandSequenceImpl: () => 0,
  });

  assert.equal(status, 0);
  assert.equal(heavyLockCalls, 0);
});

test('runCommandSequence handles large stdout without hitting the default spawnSync buffer limit', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oneflowbase-warning-capture-'));
  const scriptPath = path.join(repoRoot, 'emit-large-output.js');

  fs.writeFileSync(
    scriptPath,
    'process.stdout.write("x".repeat(2 * 1024 * 1024));\n'
  );

  const status = runCommandSequence({
    repoRoot,
    scope: 'warning-capture-large-output',
    commands: [
      {
        label: 'large-output',
        command: process.execPath,
        args: [scriptPath],
      },
    ],
    spawnSyncImpl: spawnSync,
    writeStdout() {},
    writeStderr() {},
  });

  assert.equal(status, 0);
});
