# 2026-04-11 P1 架构文档技术栈对齐记录

- 已将前端技术栈正式写入 `p1-architecture`：`React + Vite + TanStack Router + Ant Design + CSS Modules/CSS Variables + TanStack Query + Zustand + xyflow + Lexical + Monaco`。
- 已将画布内设计正式写入 `p1-architecture`：控制台外壳继续使用 `Ant Design`，画布内部增加一层薄的 `Editor UI` 自封装，不新增主样式框架，不把 `Ant Design` 直接铺进节点主体。
- 已将后端技术栈正式写入 `p1-architecture`：`Axum`、`Tokio`、`Tower + tower-http`、`SQLx`、`utoipa`、`tracing + tracing-subscriber`、`argon2`、`UUIDv7`。
- 已将 Rust workspace 正式改为 `apps/api-server + apps/plugin-runner + crates/*`，其中 `plugin-runner` 是内部 Rust 执行进程，不对公网暴露。
- 已将 API 与鉴权边界正式写入：控制台 `REST JSON + 服务端 Session + HttpOnly Cookie + CSRF`；运行调试 `REST + SSE`；发布接口采用应用级 `API Key / Token`；插件内部调用采用内部 `RPC` 契约，P1 初版可承载在内网 HTTP。
- 已将插件架构从旧的“进程内插件”改为“`hosted` + `runner_wasm` 双轨”，并明确 P1 官方代码插件语言先锁 `Rust`。
- 已将 P1 部署拓扑正式改为：`web + api-server + plugin-runner + postgres + redis + rustfs + nginx`，同时明确主要流量路径。
