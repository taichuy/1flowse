const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('path');

const {
  parseCliArgs,
  shouldManageDocker,
  selectServiceKeys,
  getServiceDefinitions,
  ensureRustfsVolumePermissions,
} = require('../core.js');

test('parseCliArgs defaults to full start', () => {
  assert.deepEqual(parseCliArgs([]), {
    action: 'start',
    scope: 'all',
    skipDocker: false,
    help: false,
  });
});

test('parseCliArgs supports backend restart without docker', () => {
  assert.deepEqual(parseCliArgs(['restart', '--backend-only', '--skip-docker']), {
    action: 'restart',
    scope: 'backend',
    skipDocker: true,
    help: false,
  });
});

test('shouldManageDocker skips docker for frontend-only runs', () => {
  assert.equal(
    shouldManageDocker({
      scope: 'frontend',
      skipDocker: false,
    }),
    false
  );
});

test('selectServiceKeys maps scopes to managed services', () => {
  assert.deepEqual(selectServiceKeys('all'), ['web', 'api-server', 'plugin-runner']);
  assert.deepEqual(selectServiceKeys('frontend'), ['web']);
  assert.deepEqual(selectServiceKeys('backend'), ['api-server', 'plugin-runner']);
});

test('getServiceDefinitions uses repo default ports without command overrides', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const services = getServiceDefinitions(repoRoot);

  assert.equal(services.web.port, 3100);
  assert.equal(services['api-server'].port, 7800);
  assert.equal(services['plugin-runner'].port, 7801);
  assert.deepEqual(services.web.args, ['--filter', '@1flowse/web', 'dev']);
  assert.deepEqual(services['api-server'].args, ['run', '-p', 'api-server']);
  assert.deepEqual(services['plugin-runner'].args, ['run', '-p', 'plugin-runner']);
});

test('ensureRustfsVolumePermissions creates writable rustfs bind mount directories', () => {
  const tempRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oneflowse-dev-up-'));
  const dockerDir = path.join(tempRepoRoot, 'docker');
  const rustfsDataDir = path.join(dockerDir, 'volumes', 'rustfs', 'data');
  const rustfsLogsDir = path.join(dockerDir, 'volumes', 'rustfs', 'logs');

  fs.mkdirSync(rustfsDataDir, { recursive: true, mode: 0o755 });
  fs.mkdirSync(rustfsLogsDir, { recursive: true, mode: 0o755 });

  ensureRustfsVolumePermissions(tempRepoRoot);

  assert.equal(fs.statSync(path.join(dockerDir, 'volumes', 'rustfs')).mode & 0o777, 0o777);
  assert.equal(fs.statSync(rustfsDataDir).mode & 0o777, 0o777);
  assert.equal(fs.statSync(rustfsLogsDir).mode & 0o777, 0o777);
});
