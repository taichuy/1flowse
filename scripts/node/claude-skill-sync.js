#!/usr/bin/env node

const { main: toolingMain } = require('./tooling');
const main = (argv = []) => toolingMain(['claude-skill-sync', ...argv]);

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`[1flowbase-claude-skill-sync] ${error.message}\n`);
  process.exitCode = 1;
});
