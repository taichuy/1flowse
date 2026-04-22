#!/usr/bin/env node

const {
  parseScriptCliArgs: parseCliArgs,
  listTestFiles,
  selectTestFiles,
  buildScriptTestCommand: buildCommand,
  runScripts: main,
} = require('./test');

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[1flowbase-test-scripts] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseCliArgs,
  listTestFiles,
  selectTestFiles,
  buildCommand,
  main,
};
