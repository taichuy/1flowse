const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const viteConfigPath = path.resolve(__dirname, '..', '..', '..', '..', 'web', 'app', 'vite.config.ts');

test('vite config uses the repo default frontend port', () => {
  const viteConfigSource = fs.readFileSync(viteConfigPath, 'utf8');

  assert.match(viteConfigSource, /server:\s*\{/u);
  assert.match(viteConfigSource, /host:\s*'127\.0\.0\.1'/u);
  assert.match(viteConfigSource, /port:\s*3100/u);
  assert.match(viteConfigSource, /strictPort:\s*true/u);
});
