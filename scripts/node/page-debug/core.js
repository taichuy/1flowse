const path = require('node:path');

const DEFAULT_WEB_BASE_URL = 'http://127.0.0.1:3100';
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:7800';
const DEFAULT_TIMEOUT = 15000;
const MODES = new Set(['snapshot', 'open', 'login']);

function getRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function parseCliArgs(argv) {
  const options = {
    help: false,
    mode: 'snapshot',
    target: null,
    webBaseUrl: DEFAULT_WEB_BASE_URL,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    outDir: null,
    headless: true,
    timeout: DEFAULT_TIMEOUT,
    account: null,
    password: null,
    waitForSelector: null,
    waitForUrl: null,
  };

  const args = [...argv];
  if (args.includes('-h') || args.includes('--help')) {
    return { ...options, help: true };
  }

  if (args[0] && MODES.has(args[0])) {
    options.mode = args.shift();
  }

  if (options.mode !== 'login' && args[0] && !args[0].startsWith('--')) {
    options.target = args.shift();
  }

  while (args.length > 0) {
    const arg = args.shift();
    const value = args[0];

    if (arg === '--web-base-url') {
      options.webBaseUrl = args.shift();
    } else if (arg === '--api-base-url') {
      options.apiBaseUrl = args.shift();
    } else if (arg === '--out-dir') {
      options.outDir = args.shift();
    } else if (arg === '--headless') {
      options.headless = value !== 'false' ? true : (args.shift(), false);
    } else if (arg === '--timeout') {
      options.timeout = Number.parseInt(args.shift(), 10);
    } else if (arg === '--account') {
      options.account = args.shift();
    } else if (arg === '--password') {
      options.password = args.shift();
    } else if (arg === '--wait-for-selector') {
      options.waitForSelector = args.shift();
    } else if (arg === '--wait-for-url') {
      options.waitForUrl = args.shift();
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }

  if (options.mode !== 'login' && !options.target) {
    throw new Error(`模式 ${options.mode} 需要提供目标路由或 URL`);
  }

  if (options.mode === 'open' && argv.includes('--headless') === false) {
    options.headless = false;
  }

  return options;
}

function resolveTargetUrl(webBaseUrl, target) {
  return /^https?:\/\//u.test(target) ? target : new URL(target, webBaseUrl).toString();
}

function createRunArtifacts({ repoRoot, mode, outDir, now = new Date() }) {
  if (mode === 'login') {
    return {
      runDir: null,
      metaPath: null,
      storageStatePath: null,
      htmlPath: null,
      screenshotPath: null,
      consoleLogPath: null,
    };
  }

  const timestamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const runDir = outDir
    ? path.resolve(repoRoot, outDir)
    : path.join(repoRoot, 'tmp', 'page-debug', timestamp);

  return {
    runDir,
    metaPath: path.join(runDir, 'meta.json'),
    storageStatePath: path.join(runDir, 'storage-state.json'),
    htmlPath: mode === 'snapshot' ? path.join(runDir, 'index.html') : null,
    screenshotPath: path.join(runDir, 'page.png'),
    consoleLogPath: path.join(runDir, 'console.ndjson'),
  };
}

function createSuccessResult({
  mode,
  requestedUrl,
  finalUrl,
  authenticated,
  readyState,
  artifacts,
  warnings,
}) {
  return {
    ok: true,
    mode,
    requestedUrl,
    finalUrl,
    authenticated,
    readyState,
    outputDir: artifacts.runDir,
    metaPath: artifacts.metaPath,
    storageStatePath: artifacts.storageStatePath,
    htmlPath: artifacts.htmlPath,
    screenshotPath: artifacts.screenshotPath,
    consoleLogPath: artifacts.consoleLogPath,
    warnings,
  };
}

async function main() {
  throw new Error('page-debug orchestration is not wired yet');
}

module.exports = {
  DEFAULT_API_BASE_URL,
  DEFAULT_TIMEOUT,
  DEFAULT_WEB_BASE_URL,
  createRunArtifacts,
  createSuccessResult,
  getRepoRoot,
  main,
  parseCliArgs,
  resolveTargetUrl,
};
