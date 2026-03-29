#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const TMP_DIR = path.join(REPO_ROOT, 'tmp', 'dev-up');
const LOG_DIR = path.join(REPO_ROOT, 'tmp', 'logs');
const PID_DIR = path.join(TMP_DIR, 'pids');
const MIDDLEWARE_DIR = path.join(REPO_ROOT, 'docker');
const API_DIR = path.join(REPO_ROOT, 'api');
const WEB_DIR = path.join(REPO_ROOT, 'web');

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(PID_DIR, { recursive: true });

let action = 'start';
let startWorker = true;
let startBeat = true;
let skipInstall = false;
let composeCommand = null;

function usage() {
  process.stdout.write(`用法：node scripts/dev-up.js [选项] [start|stop|pause|status]

默认动作：start

选项：
  --skip-install  跳过 \`uv sync\` 与 \`pnpm install\`
  --no-worker     不启动 Celery worker
  --no-beat       不启动 Celery beat
  -h, --help      查看帮助

示例：
  node scripts/dev-up.js
  node scripts/dev-up.js --skip-install
  node scripts/dev-up.js start --skip-install
  node scripts/dev-up.js status
  node scripts/dev-up.js pause
  node scripts/dev-up.js stop
  node scripts/dev-pause.js
`);
}

function log(message) {
  process.stdout.write(`[7flows-dev-up] ${message}\n`);
}

function commandExists(commandName) {
  const pathValue = process.env.PATH || '';
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat', '.ps1'] : [''];

  for (const directory of directories) {
    for (const extension of extensions) {
      const fullPath = path.join(directory, `${commandName}${extension}`);
      if (fs.existsSync(fullPath)) {
        return true;
      }
    }
  }

  return false;
}

function requireCommand(commandName) {
  if (!commandExists(commandName)) {
    throw new Error(`缺少命令：${commandName}`);
  }
}

function displayPath(targetPath) {
  const relativePath = path.relative(REPO_ROOT, targetPath);
  if (relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath.split(path.sep).join('/');
  }

  return targetPath;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  return result;
}

function ensureCommandSuccess(description, result) {
  if (!result.error && result.status === 0) {
    return;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  throw new Error(`${description} 失败，退出码 ${result.status}`);
}

function resolveComposeCommand() {
  const dockerComposeResult = runCommand('docker', ['compose', 'version'], { captureOutput: true });
  if (!dockerComposeResult.error && dockerComposeResult.status === 0) {
    composeCommand = { command: 'docker', baseArgs: ['compose'] };
    return;
  }

  const legacyComposeResult = runCommand('docker-compose', ['version'], { captureOutput: true });
  if (!legacyComposeResult.error && legacyComposeResult.status === 0) {
    composeCommand = { command: 'docker-compose', baseArgs: [] };
    return;
  }

  throw new Error('缺少 `docker compose` 或 `docker-compose` 命令');
}

function runMiddlewareCompose(args, options = {}) {
  const result = runCommand(composeCommand.command, [
    ...composeCommand.baseArgs,
    '-f',
    'docker-compose.middleware.yaml',
    ...args,
  ], {
    cwd: MIDDLEWARE_DIR,
    captureOutput: options.captureOutput === true,
  });

  if (options.allowFailure === true) {
    return result;
  }

  ensureCommandSuccess(`docker 中间件命令 ${args.join(' ')}`, result);
  return result;
}

function copyIfMissing(examplePath, targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(examplePath, targetPath);
    log(`已创建 ${displayPath(targetPath)}`);
  }
}

function pidFileFor(serviceName) {
  return path.join(PID_DIR, `${serviceName}.pid`);
}

function logFileFor(serviceName) {
  return path.join(LOG_DIR, `${serviceName}.log`);
}

function readPid(pidFile) {
  if (!fs.existsSync(pidFile)) {
    return null;
  }

  const rawValue = fs.readFileSync(pidFile, 'utf8').trim();
  if (!rawValue) {
    return null;
  }

  const pid = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  return pid;
}

function isPidRunning(pidFile) {
  const pid = readPid(pidFile);
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function cleanupStalePid(pidFile) {
  if (fs.existsSync(pidFile) && !isPidRunning(pidFile)) {
    fs.rmSync(pidFile, { force: true });
  }
}

function sleepSync(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function readTail(filePath, maxLines = 40) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line, index, allLines) => !(index === allLines.length - 1 && line === ''));

  return lines.slice(-maxLines).join('\n');
}

function startBackgroundProcess(serviceName, workdir, command, args) {
  const pidFile = pidFileFor(serviceName);
  const logFile = logFileFor(serviceName);

  cleanupStalePid(pidFile);

  if (isPidRunning(pidFile)) {
    log(`${serviceName} 已在运行，PID=${readPid(pidFile)}`);
    return;
  }

  log(`启动 ${serviceName}，日志：${displayPath(logFile)}`);
  const outputHandle = fs.openSync(logFile, 'a');
  const child = spawn(command, args, {
    cwd: workdir,
    detached: true,
    env: process.env,
    stdio: ['ignore', outputHandle, outputHandle],
  });

  child.unref();
  fs.closeSync(outputHandle);

  if (!child.pid) {
    throw new Error(`${serviceName} 启动失败，请查看 ${displayPath(logFile)}`);
  }

  fs.writeFileSync(pidFile, String(child.pid));

  sleepSync(1000);
  if (isPidRunning(pidFile)) {
    log(`${serviceName} 已启动，PID=${readPid(pidFile)}`);
    return;
  }

  const tailOutput = readTail(logFile);
  const error = new Error(`${serviceName} 启动失败，请查看 ${displayPath(logFile)}`);
  if (tailOutput) {
    process.stderr.write(`${tailOutput}\n`);
  }
  throw error;
}

function killProcessGroup(pid, signal) {
  const targets = process.platform === 'win32' ? [pid] : [-pid, pid];

  for (const target of targets) {
    try {
      process.kill(target, signal);
      return;
    } catch (error) {
      if (error && error.code === 'ESRCH') {
        continue;
      }
    }
  }
}

function stopBackgroundProcess(serviceName) {
  const pidFile = pidFileFor(serviceName);
  cleanupStalePid(pidFile);

  if (!fs.existsSync(pidFile)) {
    log(`${serviceName} 未运行`);
    return;
  }

  const pid = readPid(pidFile);
  if (pid && isPidRunning(pidFile)) {
    killProcessGroup(pid, 'SIGTERM');
    sleepSync(1000);
    if (isPidRunning(pidFile)) {
      killProcessGroup(pid, 'SIGKILL');
    }
  }

  fs.rmSync(pidFile, { force: true });
  log(`${serviceName} 已停止`);
}

function printProcessStatus(serviceName) {
  const pidFile = pidFileFor(serviceName);
  cleanupStalePid(pidFile);

  if (isPidRunning(pidFile)) {
    process.stdout.write(`${serviceName.padEnd(12)} running (PID=${readPid(pidFile)})\n`);
    return;
  }

  process.stdout.write(`${serviceName.padEnd(12)} stopped\n`);
}

function runWithRetries(description, attempts, runner) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      runner();
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(`${description} 失败，已尝试 ${attempts} 次\n${error.message}`);
      }

      log(`${description} 第 ${attempt} 次失败，3 秒后重试`);
      sleepSync(3000);
    }
  }
}

function prepareEnvFiles() {
  copyIfMissing(path.join(MIDDLEWARE_DIR, 'middleware.env.example'), path.join(MIDDLEWARE_DIR, 'middleware.env'));
  copyIfMissing(path.join(API_DIR, '.env.example'), path.join(API_DIR, '.env'));
  copyIfMissing(path.join(WEB_DIR, '.env.example'), path.join(WEB_DIR, '.env.local'));
}

function ensureDependencies() {
  if (skipInstall) {
    log('按参数跳过依赖同步');
    return;
  }

  log('同步 API 依赖');
  ensureCommandSuccess('同步 API 依赖', runCommand('uv', ['sync', '--extra', 'dev'], { cwd: API_DIR }));

  log('同步 Web 依赖');
  ensureCommandSuccess(
    '同步 Web 依赖',
    runCommand('corepack', ['pnpm', 'install'], { cwd: WEB_DIR }),
  );
}

function startMiddleware() {
  log('启动 docker 中间件');
  runMiddlewareCompose(['up', '-d']);
}

function runMigrations() {
  log('执行 API migration');
  runWithRetries('API migration', 10, () => {
    ensureCommandSuccess(
      '执行 API migration',
      runCommand('uv', ['run', 'alembic', 'upgrade', 'head'], { cwd: API_DIR }),
    );
  });
}

function startAll() {
  requireCommand('docker');
  requireCommand('uv');
  requireCommand('corepack');
  resolveComposeCommand();

  prepareEnvFiles();
  ensureDependencies();
  startMiddleware();
  runMigrations();

  startBackgroundProcess('api', API_DIR, 'uv', [
    'run',
    'uvicorn',
    'app.main:app',
    '--reload',
    '--host',
    '0.0.0.0',
    '--port',
    '8000',
  ]);
  if (startWorker) {
    startBackgroundProcess('worker', API_DIR, 'uv', [
      'run',
      'celery',
      '-A',
      'app.core.celery_app.celery_app',
      'worker',
      '--loglevel',
      'INFO',
      '--pool',
      'solo',
    ]);
  }
  if (startBeat) {
    startBackgroundProcess('beat', API_DIR, 'uv', [
      'run',
      'celery',
      '-A',
      'app.core.celery_app.celery_app',
      'beat',
      '--loglevel',
      'INFO',
    ]);
  }
  startBackgroundProcess('web', WEB_DIR, 'corepack', ['pnpm', 'dev']);

  process.stdout.write(`
启动完成：
- API:  http://localhost:8000
- Web:  http://localhost:3100
- 日志: tmp/logs/

常用命令：
- 查看状态：node scripts/dev-up.js status
- 暂停全部：node scripts/dev-pause.js
- 停止全部：node scripts/dev-up.js stop
`);
}

function stopAll() {
  requireCommand('docker');
  resolveComposeCommand();

  stopBackgroundProcess('web');
  stopBackgroundProcess('beat');
  stopBackgroundProcess('worker');
  stopBackgroundProcess('api');

  log('停止 docker 中间件');
  runMiddlewareCompose(['down']);
}

function statusAll() {
  requireCommand('docker');
  resolveComposeCommand();

  printProcessStatus('api');
  printProcessStatus('worker');
  printProcessStatus('beat');
  printProcessStatus('web');
  process.stdout.write('\nDocker middleware:\n');

  const result = runMiddlewareCompose(['ps'], { allowFailure: true });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function parseArgs(args) {
  for (const currentArg of args) {
    switch (currentArg) {
      case 'start':
      case 'stop':
      case 'pause':
      case 'status':
        if (action !== 'start') {
          throw new Error(`动作只能指定一次：已收到 ${action}，又收到 ${currentArg}`);
        }
        action = currentArg;
        break;
      case '--skip-install':
        skipInstall = true;
        break;
      case '--no-worker':
        startWorker = false;
        break;
      case '--no-beat':
        startBeat = false;
        break;
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      default:
        throw new Error(`未知参数：${currentArg}`);
    }
  }
}

function main() {
  try {
    parseArgs(process.argv.slice(2));

    switch (action) {
      case 'start':
        startAll();
        break;
      case 'stop':
      case 'pause':
        stopAll();
        break;
      case 'status':
        statusAll();
        break;
      default:
        usage();
        process.exit(1);
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (action !== 'start' || !/^未知参数：/.test(message)) {
      process.stderr.write('\n');
    }
    usage();
    process.exit(1);
  }
}

main();
