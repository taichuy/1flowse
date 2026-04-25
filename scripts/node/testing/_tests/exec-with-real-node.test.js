const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('exec-with-real-node shell launcher forwards child exit codes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oneflowbase-real-node-launcher-'));
  const binDir = path.join(tempDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.symlinkSync(process.execPath, path.join(binDir, 'pnpm'));
  fs.symlinkSync(process.execPath, path.join(binDir, 'node'));

  const childScript = path.join(tempDir, 'exit-code.js');
  fs.writeFileSync(
    childScript,
    'process.exit(Number(process.argv[2] ?? 0));\n',
    'utf8'
  );

  const launcherPath = path.join(process.cwd(), 'scripts/node/exec-with-real-node.sh');
  const result = spawnSync(
    'bash',
    [launcherPath, childScript, '7'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 7);
  assert.equal(result.signal, null);
});
