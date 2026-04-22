#!/usr/bin/env node

const {
  buildRuntimeGateCommand: buildCommand,
  runRuntimeGate: main,
} = require('./tooling');

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[1flowbase-runtime-gate] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildCommand,
  main,
};
