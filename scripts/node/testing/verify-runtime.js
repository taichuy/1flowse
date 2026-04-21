const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LOCAL_VERIFY_CONFIG_FILE = '.1flowbase.verify.local.json';
const VERIFY_LOCK_TOKEN_ENV = 'ONEFLOWBASE_VERIFY_LOCK_TOKEN';
const DEFAULT_WAIT_TIMEOUT_MINUTES = 30;
const DEFAULT_POLL_INTERVAL_MS = 5000;

function getAvailableParallelism() {
  if (typeof os.availableParallelism === 'function') {
    return os.availableParallelism();
  }

  return os.cpus().length;
}

function isCiEnvironment(env = process.env) {
  return env.CI === 'true' || env.GITHUB_ACTIONS === 'true';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function resolveCargoDefaults(availableParallelism) {
  const parallelism = assertPositiveInteger('availableParallelism', availableParallelism);
  const cargoJobs = Math.max(1, Math.floor(parallelism / 2));

  return {
    cargoJobs: Math.min(cargoJobs, parallelism),
    cargoTestThreads: Math.min(cargoJobs, parallelism),
  };
}

function readLocalVerifyConfig(repoRoot, env = process.env) {
  if (isCiEnvironment(env)) {
    return null;
  }

  const configPath = path.join(repoRoot, LOCAL_VERIFY_CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const raw = fs.readFileSync(configPath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${LOCAL_VERIFY_CONFIG_FILE}: ${error.message}`);
  }
}

function resolveRuntimeConfig(config, availableParallelism) {
  const defaults = resolveCargoDefaults(availableParallelism);
  const backendConfig = isPlainObject(config.backend) ? config.backend : {};
  const locksConfig = isPlainObject(config.locks) ? config.locks : {};

  const cargoJobs = backendConfig.cargoJobs ?? defaults.cargoJobs;
  const cargoTestThreads = backendConfig.cargoTestThreads ?? defaults.cargoTestThreads;
  const waitTimeoutMinutes = locksConfig.waitTimeoutMinutes ?? DEFAULT_WAIT_TIMEOUT_MINUTES;
  const pollIntervalMs = locksConfig.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  assertPositiveInteger('backend.cargoJobs', cargoJobs);
  assertPositiveInteger('backend.cargoTestThreads', cargoTestThreads);
  assertPositiveInteger('locks.waitTimeoutMinutes', waitTimeoutMinutes);
  assertPositiveInteger('locks.pollIntervalMs', pollIntervalMs);

  if (cargoJobs > availableParallelism) {
    throw new Error('backend.cargoJobs must not exceed availableParallelism');
  }

  if (cargoTestThreads > availableParallelism) {
    throw new Error('backend.cargoTestThreads must not exceed availableParallelism');
  }

  return {
    backend: {
      cargoJobs,
      cargoTestThreads,
    },
    locks: {
      waitTimeoutMinutes,
      waitTimeoutMs: waitTimeoutMinutes * 60 * 1000,
      pollIntervalMs,
    },
  };
}

function loadVerifyRuntimeConfig({
  repoRoot,
  env = process.env,
  availableParallelism = getAvailableParallelism(),
} = {}) {
  const config = readLocalVerifyConfig(repoRoot, env) ?? {};
  return resolveRuntimeConfig(config, availableParallelism);
}

module.exports = {
  LOCAL_VERIFY_CONFIG_FILE,
  VERIFY_LOCK_TOKEN_ENV,
  getAvailableParallelism,
  isCiEnvironment,
  loadVerifyRuntimeConfig,
};
