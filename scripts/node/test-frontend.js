#!/usr/bin/env node

const {
  parseFrontendCliArgs: parseCliArgs,
  buildFrontendCommands: buildCommands,
  runFrontend: main,
} = require('./test');

if (require.main === module) {
  Promise.resolve()
    .then(() => main(process.argv.slice(2)))
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      process.stderr.write(`[1flowbase-test-frontend] ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  parseCliArgs,
  buildCommands,
  main,
};
