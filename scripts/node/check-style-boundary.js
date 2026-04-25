#!/usr/bin/env node

const { main: toolingMain } = require('./tooling/index.js');
const main = (argv = []) => toolingMain(['check-style-boundary', ...argv]);

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`[1flowbase-style-boundary] ${error.message}\n`);
  process.exitCode = 1;
});
