const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildCommand, main } = require('../../runtime-gate.js');

test('buildCommand proxies runtime-gate arguments to page-debug', () => {
  const repoRoot = '/repo-root';

  assert.deepEqual(buildCommand({
    argv: ['snapshot', '/settings', '--timeout', '5000'],
    repoRoot,
  }), {
    label: 'runtime-page-debug',
    command: process.execPath,
    args: [
      path.join(repoRoot, 'scripts', 'node', 'tooling.js'),
      'page-debug',
      'snapshot',
      '/settings',
      '--timeout',
      '5000',
    ],
    cwd: repoRoot,
  });
});

test('main writes advisory warning output under tmp/test-governance', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oneflowbase-runtime-gate-'));
  const calls = [];

  const status = main(['snapshot', '/settings'], {
    repoRoot,
    env: {},
    writeStdout() {},
    writeStderr() {},
    spawnSyncImpl(command, args, options) {
      calls.push({ command, args, options });

      return {
        status: 0,
        stdout: '',
        stderr: 'warning: runtime gate advisory\n',
      };
    },
  });

  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual(calls[0].args, [
    path.join(repoRoot, 'scripts', 'node', 'tooling.js'),
    'page-debug',
    'snapshot',
    '/settings',
  ]);

  const warningLogPath = path.join(repoRoot, 'tmp', 'test-governance', 'runtime-gate.warnings.log');
  assert.equal(fs.existsSync(warningLogPath), true);
  assert.match(fs.readFileSync(warningLogPath, 'utf8'), /warning: runtime gate advisory/u);
});
