#!/usr/bin/env node

const {
  parseCoverageCliArgs: parseCliArgs,
  buildCoverageFrontendCommand: buildFrontendCommand,
  collectFrontendCoverageFailures,
  buildCoverageBackendCleanupCommands: buildBackendCleanupCommands,
  buildCoverageBackendCommands: buildBackendCommands,
  collectBackendCoverageFailures,
  ensureCargoLlvmCovInstalled,
  runCoverage: main,
} = require('./verify');

if (require.main === module) {
  Promise.resolve()
    .then(() => main(process.argv.slice(2)))
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      process.stderr.write(`[${COVERAGE_SCOPE_LABEL}] ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  parseCliArgs,
  buildFrontendCommand,
  buildBackendCommands,
  buildBackendCleanupCommands,
  collectFrontendCoverageFailures,
  collectBackendCoverageFailures,
  ensureCargoLlvmCovInstalled,
  main,
};
