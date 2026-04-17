# Frontend Browser Verification

## Default Toolchain

- 前端页面的浏览器打开、检查、截图和交互复现，默认使用 `Playwright`。
- 不要把 Chrome 浏览器 MCP / `chrome-devtools` 当成前端默认链路，除非用户明确指定。

## Execution Rules

- 优先复用项目已有 `Playwright` 或 `style-boundary` 运行时验收链路。
- 截图、点击、等待都应基于业务 ready signal，例如稳定文案、关键节点、页面主标题，而不是页面一打开就直接操作。
- 需要补充页面证据时，优先保留 `uploads/` 中的截图或失败证据，而不是只给口头判断。

## Fallback

- 若 Playwright 当前环境缺浏览器二进制、截图命令不可用或链路受限，先看已有 `tool-memory/playwright` 和 `style-boundary` 的已验证替代方案。
- 不要因为 Playwright 一次失败，就默认回退到 Chrome 浏览器 MCP。
