# N4 验证门禁编排报告

## 范围

涉及区域：

- `scripts/node/verify/index.js`
- `scripts/node/verify-repo/_tests/cli.test.js`
- `scripts/node/verify-ci/_tests/cli.test.js`
- `scripts/node/testing/_tests/real-node-command-routing.test.js`
- `scripts/node/test/index.js`
- `scripts/node/test-backend/_tests/cli.test.js`

## 问题

原验证门禁存在两类问题：

- `verify-repo` 包含 `coverage all`，导致仓库级开发回归过重。
- `test-backend --help` 会进入后端 managed runner，帮助命令不够轻量。

这会降低开发回测速度，也让 repo gate 与 CI gate 的职责边界不清晰。

## 修复

- `verify-repo` 调整为：
  - scripts/node tests
  - contract tests
  - frontend full gate
  - backend full gate
- `verify-ci` 调整为：
  - `verify-repo`
  - `verify-coverage all`
- `test-backend --help` 只打印帮助，不触发后端重门禁。
- 同步更新脚本测试断言。

## 关键收益

- 开发回归速度更可控。
- coverage 仍保留在 CI gate，不降低 CI 收口标准。
- 帮助命令行为符合 CLI 预期。
- 门禁编排意图更清晰。

## 验证

已通过：

- `node scripts/node/test-scripts.js`
  - `176` tests passed
- `node scripts/node/test-backend.js --help`

## 残留风险

Medium：

- 本轮未实际执行 `node scripts/node/verify-ci.js`，因此不能对完整 CI 时长和 coverage 结果下结论。

Low：

- `verify-repo` 与 `verify-ci` 的职责已拆开，但后续文档和团队习惯也需要同步，否则仍可能误用。

