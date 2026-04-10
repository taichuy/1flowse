# 2026-04-11 产品设计稿口径对齐记录

- 已将“控制台认证采用 `服务端 Session + HttpOnly Cookie + CSRF`”回写到 `docs/superpowers/specs/1flowse/2026-04-10-product-design.md`。
- 已在产品设计稿中补充插件双路径：`hosted` 与 `runner_wasm`。
- 已明确 `plugin-runner` 是后端体系内部的独立 Rust 执行进程，不对公网暴露；系统对外主入口仍是 `api-server`。
- 已明确 `api-server -> plugin-runner` 采用内部 `RPC` 契约，P1 初版可承载在内网 HTTP 上；RPC 是契约层，HTTP 是传输层。
- 已明确 `runtime-worker` 在 P1 仍不独立拆分，Flow 运行时继续在 `api-server` 内。
- 已明确 P1 代码插件官方支持语言先锁 `Rust`，不放宽为任意可编译到 Wasm 的多语言生态。
- 已补充 P1 不做前端代码插件体系，插件主线继续聚焦后端能力扩展。
