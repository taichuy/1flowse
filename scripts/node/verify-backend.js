#!/usr/bin/env node
const os = require("node:os");
const { spawnSync } = require("node:child_process");

function getAvailableParallelism() {
  if (typeof os.availableParallelism === "function") {
    return os.availableParallelism();
  }

  return os.cpus().length;
}

function getCargoParallelism() {
  return Math.max(1, Math.floor(getAvailableParallelism() / 2));
}

const cargoParallelism = getCargoParallelism();

const commands = [
  ["cargo", ["fmt", "--all", "--check"]],
  ["cargo", ["clippy", "--workspace", "--all-targets", "--jobs", String(cargoParallelism), "--", "-D", "warnings"]],
  ["cargo", ["test", "--workspace", "--jobs", String(cargoParallelism), "--", `--test-threads=${cargoParallelism}`]],
  ["cargo", ["check", "--workspace", "--jobs", String(cargoParallelism)]],
];

for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: "api",
    env: {
      ...process.env,
      CARGO_BUILD_JOBS: String(cargoParallelism),
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
