const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const composeFilePath = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'docker',
  'docker-compose.middleware.yaml'
);

test('rustfs compose mounts host logs into the path used by the image', () => {
  const composeSource = fs.readFileSync(composeFilePath, 'utf8');

  assert.match(composeSource, /- \.\/volumes\/rustfs\/logs:\/logs/u);
});
