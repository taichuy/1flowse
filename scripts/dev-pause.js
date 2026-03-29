#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

const scriptPath = path.join(__dirname, 'dev-up.js');
const result = spawnSync(process.execPath, [scriptPath, 'pause', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status === null ? 1 : result.status);
