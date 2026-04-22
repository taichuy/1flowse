const test = require('node:test');
const assert = require('node:assert/strict');

const { main } = require('../index.js');

test('verify index dispatches repo subcommand', async () => {
  let capturedArgv = null;

  const status = await main(['repo'], {
    runRepoImpl(argv) {
      capturedArgv = argv;
      return 0;
    },
  });

  assert.equal(status, 0);
  assert.deepEqual(capturedArgv, []);
});

test('verify index dispatches coverage subcommand with remaining args', async () => {
  let capturedArgv = null;

  const status = await main(['coverage', 'backend'], {
    runCoverageImpl(argv) {
      capturedArgv = argv;
      return 0;
    },
  });

  assert.equal(status, 0);
  assert.deepEqual(capturedArgv, ['backend']);
});

test('verify index rejects unknown subcommands', async () => {
  await assert.rejects(
    () => main(['unknown']),
    /Unknown verify command: unknown/u
  );
});
