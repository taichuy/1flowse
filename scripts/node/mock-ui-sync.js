#!/usr/bin/env node

const { main: toolingMain } = require('./tooling/index.js');
const main = (argv = []) => toolingMain(['mock-ui-sync', ...argv]);

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`[1flowbase-mock-ui-sync] ${error.message}\n`);
  process.exitCode = 1;
});
