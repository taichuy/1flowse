const test = require('node:test');
const assert = require('node:assert/strict');

const { main } = require('../index.js');

test('test index dispatches backend subcommand', async () => {
  let capturedArgv = null;

  const status = await main(['backend'], {
    runBackendImpl(argv) {
      capturedArgv = argv;
      return 0;
    },
  });

  assert.equal(status, 0);
  assert.deepEqual(capturedArgv, []);
});

test('test index dispatches frontend subcommand with remaining args', async () => {
  let capturedArgv = null;

  const status = await main(['frontend', 'fast'], {
    runFrontendImpl(argv) {
      capturedArgv = argv;
      return 0;
    },
  });

  assert.equal(status, 0);
  assert.deepEqual(capturedArgv, ['fast']);
});

test('test index rejects unknown subcommands', async () => {
  await assert.rejects(
    () => main(['unknown']),
    /Unknown test command: unknown/u
  );
});
