# 运行历史摘要

- 2026-04-10 11:56-23:55 CST：P1 主线收敛为工作流、运行时、发布优先；前端锁定 `React + Vite + TanStack Router + Ant Design + TanStack Query + Zustand`，后端锁定 `Rust 模块化单体 api-server + 独立 plugin-runner`，控制台鉴权口径为 `Session + HttpOnly Cookie + CSRF`，插件宿主通信为内部 `RPC/HTTP + 固定服务密钥`。
- 2026-04-11 00:01-06:55 CST：统一口径已回写到设计文档，并产出 `fullstack-bootstrap` 设计稿与实施计划。
- 2026-04-11 06:33-07:51 CST：已完成首轮全栈骨架初始化。前端根目录收敛到 `web/`，后端根目录收敛到 `api/`；`web/app + web/packages/*` 可跑，`api/apps/api-server + api/apps/plugin-runner + api/crates/*` 可编译；`api-server` 已暴露 `/health`、`/api/console/health`、`/openapi.json`、`/docs`，`plugin-runner` 已暴露 `/health`；仓库内项目 skill 已落地到 `.agent/skills/1flowse-fullstack-bootstrap/`；已通过 `cd web && pnpm lint/test/build` 与 `cd api && cargo fmt --all --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test`，并已实际验证 `3000/3001` 以及前端 `5174`（默认 `5173` 在本机被外部进程占用）。

# 下一步计划

- 在 `web/app` 继续接入真实控制台与编辑器壳，而不是占位页面。
- 在 `api/crates/*` 内逐步填充鉴权、运行时、发布链路的真实业务实现。
