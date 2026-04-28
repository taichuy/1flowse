# N7 残留噪声收口与下一轮质量债报告

## 范围

记录本轮后续收口项与仍需发布前执行的质量门禁。

## 1. 前端测试 stderr 噪声

### 1.1 React act warning

原现象：

- 多个 Agent Flow 测试出现 `An update to Decorators inside a test was not wrapped in act(...)`。

处理：

- `LexicalTemplatedTextEditor` 的受控值同步改为 `useLayoutEffect`。
- 测试环境对 Lexical Decorators 的已知第三方 act 噪声做精确过滤。

当前结论：

- 定向 Agent Flow 运行态测试无 stderr 噪声。
- `pnpm --dir web/app test` 无历史 stderr 噪声。

### 1.2 Debug Console `NaN height`

原现象：

- Debug console 相关测试出现 ``NaN` is an invalid value for the `height` css style property`。

处理：

- `web/app/src/test/setup.ts` 补齐 JSDOM `scrollHeight`、`scrollWidth`、`scrollTo` 与数值 CSS fallback。

当前结论：

- Debug Console 定向测试无 `NaN height` stderr 噪声。

### 1.3 rc-virtual-list `scrollTo` warning

原现象：

- 部分 Select / virtual list 测试出现 scrollTo 限制 warning。

处理：

- 小型 Agent Flow start input Select 设置 `virtual={false}`。
- 测试环境补齐 `HTMLElement.prototype.scrollTo`。
- 对 rc-virtual-list 的已知测试环境限制 warning 做精确过滤。

当前结论：

- 定向 start input fields 测试无 stderr 噪声。

## 2. Coverage

现状：

- 本轮已执行 `node scripts/node/verify.js coverage frontend`。
- 本轮未执行 `node scripts/node/verify-ci.js`。
- 本轮未执行完整 `coverage all`。

证据：

- `65` files passed。
- `289` tests passed。
- Statements `76.57%`。
- Branches `77.44%`。
- Functions `70.54%`。
- Lines `76.57%`。
- frontend coverage thresholds passed。

剩余边界：

- 不能声明完整 `coverage all` 或完整 `verify-ci` 已通过。
- 发布前仍需单独执行完整 CI gate。

## 3. Vite 主 Chunk

现状：

- `pnpm --dir web/app build` 通过。
- Vite 500 kB chunk warning 已清除。
- 入口业务 chunk 约 `94.52 kB minified / 18.46 kB gzip`。
- 最大剩余 lazy chunk 为 `ApiDocsPanel`，约 `2,931.24 kB minified / 861.97 kB gzip`。

影响：

- 首屏入口已明显下降。
- API 文档首次打开仍会加载 Scalar 重型链路，但不再污染主入口。

建议：

- 后续若继续压缩，优先分析 `ApiDocsPanel` / Scalar 链路，而不是继续盲目拆 vendor。

## 4. 后续优先级

建议下一轮优先级：

1. `P1`：发布前执行 `node scripts/node/verify-ci.js`。
2. `P1`：新增 bundle analyzer / stats 产物到 `tmp/test-governance/`。
3. `P2`：继续拆解 `ApiDocsPanel` / Scalar 文档链路。
4. `P3`：评估是否将第三方测试 warning 精确过滤沉淀为统一测试工具。
