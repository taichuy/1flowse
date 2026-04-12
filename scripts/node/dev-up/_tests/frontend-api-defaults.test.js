const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const homePagePath = path.join(repoRoot, 'web', 'app', 'src', 'features', 'home', 'HomePage.tsx');
const apiClientPath = path.join(repoRoot, 'web', 'packages', 'api-client', 'src', 'index.ts');
const envExamplePath = path.join(repoRoot, 'web', 'app', '.env.example');

test('frontend API defaults point to the new backend port', () => {
  const homePageSource = fs.readFileSync(homePagePath, 'utf8');
  const apiClientSource = fs.readFileSync(apiClientPath, 'utf8');
  const envExampleSource = fs.readFileSync(envExamplePath, 'utf8');

  assert.match(homePageSource, /getDefaultApiBaseUrl/u);
  assert.match(apiClientSource, /locationLike\?\.hostname/u);
  assert.match(apiClientSource, /:7800/u);
  assert.match(envExampleSource, /current browser hostname/u);
});
