const test = require('node:test');
const assert = require('node:assert/strict');

const { runManagedCommandSequence } = require('../warning-capture.js');

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
