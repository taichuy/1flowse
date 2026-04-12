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

  assert.match(homePageSource, /http:\/\/127\.0\.0\.1:7800/u);
  assert.match(apiClientSource, /http:\/\/127\.0\.0\.1:7800/u);
  assert.match(envExampleSource, /VITE_API_BASE_URL=http:\/\/127\.0\.0\.1:7800/u);
});
