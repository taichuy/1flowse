# 1flowbase Local Verify Lock And Resource Config Design

## 背景

截至 `2026-04-21`，仓库内的质量脚本已经有统一入口，但本地资源治理仍然存在两个明显缺口：

- 单个脚本内部是串行的。`scripts/node/testing/warning-capture.js` 里的 `runCommandSequence` 会逐条 `spawnSync` 执行命令。
- 跨进程没有互斥。两个终端、两个 AI 会话，或者 `verify-ci -> verify-repo` 与手动启动的 `verify-backend`，彼此都不知道对方是否已经在跑重型验证。
- 后端默认并发对本地机器仍然偏重。`getCargoParallelism()` 当前直接取 `availableParallelism / 2`，`verify-backend` 和 `test-backend` 又把同一个值同时用于 `cargo --jobs` 和 `--test-threads`。
- 当前控制台缺少“谁正在占用验证资源”的统一状态输出，AI 和人工都只能靠进程列表或 Cargo 锁报错去猜。

用户已经确认本轮目标不是重写整套测试治理，而是在不影响 `CI/CD` 全功率运行的前提下，为本地开发增加一层明确、可见、可等待的资源治理。

## 目标

本设计要同时满足五个目标：

1. 本地允许通过一个未提交的配置文件调低后端验证并发。
2. `CI/CD` 不读取本地配置，继续保持仓库默认全功率行为。
3. 所有重型验证入口共享一把全局锁，避免重复启动导致 CPU 叠加。
4. 锁状态必须对控制台可见，至少能看到 `pid`、`startedAt`、`scope` 和当前是否仍在等待。
5. 嵌套调用链必须可重入，避免 `verify-ci -> verify-repo -> verify-backend` 自己把自己锁死。

## 非目标

本轮明确不做以下事情：

- 不为前端增加本地 worker 调参。
- 不引入多把细粒度锁，例如把 `cargo`、`pnpm`、`coverage` 拆成不同资源锁。
- 不改变现有 `verify-repo`、`verify-ci`、`verify-backend` 的命令语义和执行顺序。
- 不把本地配置变成仓库共享配置，也不要求团队成员统一提交个人机器偏好。
- 不在本轮实现浏览器态观测、系统级资源采样或进程面板。

## 决策摘要

### 1. 本地配置文件固定放仓库根目录

本地配置文件固定为：

- `.1flowbase.verify.local.json`

示例文件固定为：

- `.1flowbase.verify.local.json.example`

规则固定为：

- 实际配置文件加入 `.gitignore`，不提交仓库。
- 示例文件提交仓库，作为字段说明与推荐写法。
- 没有本地配置文件时，脚本行为与当前 `main` 保持一致。

这样做的原因是：

- 本地调参需要稳定、长期可用的位置，不适合放在容易被清理的 `tmp/`。
- 示例与真实配置分离，既能让用户快速复制，也不会把个人机器参数带进版本库。

### 2. 本地配置只影响本地执行，不影响 CI/CD

脚本只在“非 CI 环境”下尝试读取 `.1flowbase.verify.local.json`。

首版判断条件固定为：

- `CI=true` 时忽略本地配置。
- `GITHUB_ACTIONS=true` 时忽略本地配置。

这样做可以保证：

- 本地开发者可按机器能力降载。
- `GitHub Actions` 和后续 `CD` 入口继续保持仓库默认值，不被个人配置污染。

### 3. 本地配置首版只开放后端并发和锁等待参数

首版 schema 固定只开放两组字段：

```json
{
  "backend": {
    "cargoJobs": 4,
    "cargoTestThreads": 2
  },
  "locks": {
    "waitTimeoutMs": 1800000,
    "pollIntervalMs": 5000
  }
}
```

字段语义固定为：

- `backend.cargoJobs`
  - 覆盖后端 `cargo --jobs` 与 `CARGO_BUILD_JOBS`
- `backend.cargoTestThreads`
  - 只覆盖 `cargo test -- --test-threads=...`
- `locks.waitTimeoutMs`
  - 遇到重型锁占用时，最多等待多久后退出
- `locks.pollIntervalMs`
  - 等待期间轮询 owner 状态的时间间隔

约束固定为：

- 所有字段都必须是正整数。
- 未提供的字段回退到仓库默认值。
- 非法 JSON、未知顶层结构或非法数值直接报错退出，不做静默容错。

### 4. 所有重型验证入口共享一把全局锁

锁路径固定为：

- `tmp/test-governance/locks/heavy-verify/owner.json`

锁目录的职责是：

- 通过原子 `mkdir` 抢占锁目录。
- 成功后写入 `owner.json`。
- 失败时读取当前 owner 信息，决定等待、清理 stale lock 或超时退出。

这样做而不是只靠 Cargo 自己的文件锁，有两个直接收益：

- 可以把 `pnpm`、`cargo`、组合脚本统一纳入一套资源治理。
- 控制台能够输出可读的 owner 信息，而不是只看到底层工具报“资源被占用”。

### 5. 锁默认等待 30 分钟，然后超时退出

用户已确认默认行为为：

- 锁被占用时，不立即失败。
- 默认最多等待 `30` 分钟。
- 超时后打印当前 owner 信息并退出。

推荐默认值固定为：

- `waitTimeoutMs = 1800000`
- `pollIntervalMs = 5000`

等待期间控制台必须持续输出状态，格式保持稳定，例如：

```text
[1flowbase-verify-lock] busy: scope=verify-backend pid=12345 startedAt=2026-04-21T12:10:00.000Z
[1flowbase-verify-lock] waiting... elapsed=02m15s timeout=30m00s
```

### 6. 锁必须支持同一条执行链重入

如果只做“单把全局锁 + 无条件等待”，则以下路径会自锁：

- `verify-ci`
- `verify-repo`
- `verify-backend`

因此首版必须引入一个“锁 token”概念：

- 顶层脚本第一次拿到锁时生成 `token`
- 子脚本通过环境变量继承同一个 `token`
- 子脚本再次检查锁时，如果发现 `owner.json.token` 与自己一致，则直接视为同一 owner，允许重入

这样可以同时满足两件事：

- 外部并发互斥
- 内部嵌套链路不死锁

### 7. 锁范围覆盖所有重型验证入口，但不扩大到轻量脚本

首版纳入全局重型锁的入口固定为：

- `scripts/node/verify-backend.js`
- `scripts/node/test-backend.js`
- `scripts/node/verify-repo.js`
- `scripts/node/verify-ci.js`
- `scripts/node/verify-coverage.js`
- `scripts/node/test-frontend.js full`
- `scripts/node/test-contracts.js`

首版不纳入锁的入口固定为：

- `scripts/node/test-frontend.js fast`
- `scripts/node/test-scripts.js`
- `runtime-gate` 相关脚本
- 其他轻量、定向、非重型校验脚本

这里的原则是：

- 先收口最容易打满本地资源、最容易被重复启动的入口
- 不把所有脚本一刀切锁住，避免把轻量验证也变得笨重

### 8. 配置读取和锁治理都收口到 `scripts/node/testing/`

首版实现不把逻辑散落在每个入口脚本中。

统一设计为：

- 在 `scripts/node/testing/` 下新增一个共享 helper，例如 `verify-runtime.js`
- `warning-capture.js` 继续保留统一命令执行骨架
- 重型脚本通过同一层 helper 读取本地配置、获取锁和透传 token

这样做的原因是：

- 当前大部分脚本已经通过 `warning-capture.js` 收口了执行方式
- 统一治理比在每个 CLI 文件中各写一套 `pid`、`wait`、`timeout` 更易维护

## 文件设计

### 新增文件

- `.1flowbase.verify.local.json.example`
  - 本地配置示例文件
- `scripts/node/testing/verify-runtime.js`
  - 本地配置加载、schema 校验、锁获取与释放、owner 状态输出的共享 helper
- `scripts/node/testing/_tests/verify-runtime.test.js`
  - 覆盖配置解析、锁等待、stale lock 清理和 token 重入

### 修改文件

- `.gitignore`
  - 忽略 `.1flowbase.verify.local.json`
- `scripts/node/testing/warning-capture.js`
  - 接入共享 runtime helper，统一传递配置与锁上下文
- `scripts/node/verify-backend.js`
  - 使用本地后端并发配置，并声明自己属于重型验证入口
- `scripts/node/test-backend.js`
  - 使用本地后端并发配置，并声明自己属于重型验证入口
- `scripts/node/verify-repo.js`
  - 在仓库级 full gate 外层获取重型锁，并向子进程透传 token
- `scripts/node/verify-ci.js`
  - 在 CI 总入口外层获取重型锁，并向子进程透传 token
- `scripts/node/verify-coverage.js`
  - 纳入重型锁范围
- `scripts/node/test-frontend.js`
  - 只让 `full` 层进入重型锁；`fast` 保持不锁
- `scripts/node/test-contracts.js`
  - 纳入重型锁范围

## 配置设计

### 配置加载规则

配置加载顺序固定为：

1. 判断当前是否为 `CI` 或 `GITHUB_ACTIONS`
2. 如果是，则完全跳过本地配置
3. 如果不是，则在仓库根目录寻找 `.1flowbase.verify.local.json`
4. 文件不存在时回退到仓库默认值
5. 文件存在时读取、校验并返回归一化配置

### 默认值规则

仓库默认值保持当前行为：

- `cargoJobs`
  - 默认为 `Math.max(1, floor(availableParallelism / 2))`
- `cargoTestThreads`
  - 默认为与 `cargoJobs` 相同
- `waitTimeoutMs`
  - 默认为 `1800000`
- `pollIntervalMs`
  - 默认为 `5000`

本地配置只覆盖显式声明的字段，不要求用户把全部默认值都复制一遍。

### 值约束规则

为了避免“配得比机器还激进”或出现零值、负值，归一化规则固定为：

- `cargoJobs >= 1`
- `cargoTestThreads >= 1`
- `waitTimeoutMs >= 1`
- `pollIntervalMs >= 1`
- `cargoJobs` 与 `cargoTestThreads` 不允许超过 `availableParallelism`

如果数值越界，脚本直接报错退出，而不是擅自截断。

这样做的理由是：

- 这类配置属于资源治理，静默修正会让使用者误判脚本真实行为
- 报错比隐式降级更容易定位

## 锁设计

### owner 记录结构

`owner.json` 至少包含以下字段：

```json
{
  "token": "uuid",
  "pid": 12345,
  "scope": "verify-repo",
  "command": "node scripts/node/verify-repo.js",
  "cwd": "/home/taichu/git/1flowbase",
  "startedAt": "2026-04-21T12:10:00.000Z",
  "hostname": "devbox"
}
```

字段职责固定为：

- `token`
  - 用于判断是否同一条执行链重入
- `pid`
  - 用于探测 owner 进程是否仍然存活
- `scope`
  - 用于告诉控制台当前是哪个 gate 占用了锁
- `command`
  - 用于快速判断具体入口
- `cwd`
  - 便于多工作目录排查
- `startedAt`
  - 便于看到已运行时长
- `hostname`
  - 便于未来扩展到远程开发或多容器场景

### 抢锁流程

抢锁流程固定为：

1. 先生成或继承当前执行链的 `token`
2. 尝试原子创建 `tmp/test-governance/locks/heavy-verify`
3. 创建成功则写入 `owner.json`，并打印 `acquired`
4. 创建失败则读取 `owner.json`
5. 如果 `owner.token === currentToken`，则视为重入成功，不等待
6. 如果 `owner.pid` 仍存活，则进入等待循环
7. 如果 `owner.pid` 已失活，则清理 stale lock 并重试抢锁
8. 超过 `waitTimeoutMs` 后退出，并打印当前 owner 信息

### stale lock 清理规则

只有在以下条件同时满足时，才允许清理现有锁：

- 锁目录存在
- `owner.json` 缺失、损坏，或者 `pid` 明确已失活

控制台必须输出稳定提示，例如：

```text
[1flowbase-verify-lock] stale lock detected, cleaning...
```

不允许在 `pid` 仍存活时直接强拆锁，否则会引入两个重型 gate 并发运行。

### 释放规则

持有锁的执行链必须在以下时机尝试释放锁：

- 正常完成时
- `SIGINT`
- `SIGTERM`
- `uncaughtException`
- `unhandledRejection`

释放时只允许当前 owner token 删除锁目录，防止后启动的等待者误删别人的锁。

控制台建议输出：

```text
[1flowbase-verify-lock] released: scope=verify-repo pid=23456
```

## 控制台输出设计

锁相关输出必须保持前缀统一：

- `[1flowbase-verify-lock]`

首版至少提供以下几类信息：

- `acquired`
- `busy`
- `waiting`
- `stale lock detected`
- `timeout`
- `released`

这样做的目的不是做复杂监控，而是让人工和 AI 都能在同一个终端上下文里直接看到：

- 现在谁在跑
- 自己是在排队还是已经拿到锁
- 另一个验证进程是不是疑似残留

## 与现有脚本的接入方式

### 1. 后端并发读取

`verify-backend` 和 `test-backend` 继续使用现有 `buildCargoCommandEnv`，但并发来源改成“归一化后的 runtime config”：

- `cargo --jobs` 使用 `backend.cargoJobs`
- `CARGO_BUILD_JOBS` 使用 `backend.cargoJobs`
- `cargo test -- --test-threads=...` 使用 `backend.cargoTestThreads`

这样可以避免当前“编译并发”和“测试线程”被强绑定为同一个默认值，给本地用户留下更细的调节空间。

### 2. 仓库级组合脚本

`verify-repo`、`verify-ci` 这类会启动多个子脚本的入口，职责固定为：

- 在最外层获取重型锁
- 生成或继承 `token`
- 把 `token` 放进子进程环境变量

这样既可以让整个执行链只持有一把锁，也能保证子脚本在内部重入时不阻塞。

### 3. `warning-capture.js` 的角色

`warning-capture.js` 仍然负责：

- 命令串行执行
- warning 输出归档到 `tmp/test-governance/`

但它需要扩展一层共享 runtime 能力，使所有脚本都通过同一套方式获取：

- repo root
- runtime config
- lock token
- 统一 stdout 状态输出

## 测试设计

首版至少补三类测试。

### 1. 配置解析测试

需要覆盖：

- 没有 `.1flowbase.verify.local.json` 时回退默认值
- 本地文件存在时正确覆盖 `cargoJobs`、`cargoTestThreads`
- `CI=true` 时忽略本地文件
- 非法 JSON 直接失败
- 非法字段值直接失败

### 2. 锁行为测试

需要覆盖：

- 空闲时成功拿锁并写入 `owner.json`
- 已有活跃 owner 时进入等待
- stale lock 被自动清理
- 超过 `waitTimeoutMs` 后退出
- 同 token 重入不死锁
- 非 owner token 不能删除现有锁

### 3. 集成级脚本测试

需要覆盖：

- `verify-repo` 会向 `test-contracts`、`test-frontend full`、`verify-backend` 透传同一 token
- `verify-ci` 会向 `verify-repo` 和 `verify-coverage all` 透传同一 token
- `verify-backend` 和 `test-backend` 实际使用归一化后的本地并发参数

## 风险与取舍

### 1. 单把全局锁会降低本地吞吐

这是有意取舍。

本轮优先级是避免重复启动重型 gate 导致 CPU 暴增，而不是最大化本地并行吞吐。等这套互斥机制稳定后，再决定是否拆成更细粒度的资源锁。

### 2. 本地配置可能掩盖机器性能问题

这也是可接受取舍。

因为本地配置不会影响 `CI/CD`，所以它不会降低主线质量门禁，只会让开发者在个人机器上更容易控制资源占用。

### 3. 锁残留仍然可能发生

例如进程被 `SIGKILL` 强制结束时，正常释放逻辑不会执行。

因此 stale lock 检测不是可选项，而是这套设计的一部分。

## 实施顺序建议

正式实现时建议按以下顺序推进：

1. 先落 `verify-runtime.js` 的配置加载和 schema 校验
2. 再落全局重型锁与 token 重入
3. 接入 `verify-backend`、`test-backend`
4. 接入 `verify-repo`、`verify-ci`
5. 接入 `verify-coverage`、`test-frontend full`、`test-contracts`
6. 最后补示例文件、`.gitignore` 和脚本测试

这样可以先把最直接的 CPU 痛点收住，再向组合脚本层扩展，减少联动调试成本。
