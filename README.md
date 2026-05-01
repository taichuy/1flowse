# 1flowbase

1flowbase 是一个面向 AI 应用与工作流编排的全栈项目，当前仓库同时包含前端控制台、后端 API、插件运行相关能力和本地开发工具。

## Repo Layout

- `web/`: 前端根目录，`pnpm + Turbo` workspace，应用入口在 `web/app`，共享包在 `web/packages/*`。
- `api/`: 后端根目录，Rust workspace，服务入口在 `api/apps/*`，共享 crate 在 `api/crates/*`。
- `api/plugins/`: 插件源码 workspace、HostExtension manifest 与模板。
- `docker/`: 本地中间件与容器编排。
- `scripts/`: 仓库级开发、测试、验证、调试和插件脚本，详见 [scripts/README.md](scripts/README.md)。
- `docs/`: 项目文档、历史计划和质量报告。

前端命令在 `web/` 下执行，后端命令在 `api/` 下执行；仓库级自动化入口放在 `scripts/`。

## Architecture Notes

- `api/apps/api-server` owns plugin loader, deployment policy, extension inventory, infrastructure bootstrap, route mount, and boot assembly.
- `api/plugins` owns plugin source workspace files, including HostExtension source manifests and templates.
- RuntimeExtension packages continue to execute through `plugin-runner`.
- CapabilityPlugin packages are workspace-selectable abilities and are not system boot modules.

## Quick Start

本地全量启动优先使用统一开发脚本：

```bash
node scripts/node/dev-up.js
```

常用脚本、测试、验证、页面调试、插件 CLI 和临时产物清理都集中维护在 [scripts/README.md](scripts/README.md)。

## Frontend

```bash
cd web
pnpm install
pnpm dev
```

前端默认监听 `0.0.0.0:3100`，可通过本机或局域网地址访问。

## Backend

```bash
cd api
cargo run -p api-server --bin api-server
cargo run -p plugin-runner --bin plugin-runner
```

如果使用 `node scripts/node/dev-up.js`，脚本会在首次启动时自动从 `api/apps/api-server/.env.example` 生成本地 `.env`。
如果直接执行 `cargo run`，请先自行准备 `api/apps/api-server/.env`。

后端默认地址：

- `api-server`: `0.0.0.0:7800`
- `plugin-runner`: `0.0.0.0:7801`

## Middleware

```bash
docker compose -f docker/docker-compose.middleware.yaml up -d
```

## Verification

- 质量控制与验证规则以 [AGENTS.md](AGENTS.md) 为准。
- 前端质量规则与验证要求看 [web/AGENTS.md](web/AGENTS.md)。
- 后端质量规则与验证要求看 [api/AGENTS.md](api/AGENTS.md)。
- 仓库级脚本说明看 [scripts/README.md](scripts/README.md)。

## Local URLs

- Web: `http://127.0.0.1:3100` 或 `http://<本机IP>:3100`
- API Health: `http://127.0.0.1:7800/health` 或 `http://<本机IP>:7800/health`
- Console Health: `http://127.0.0.1:7800/api/console/health` 或 `http://<本机IP>:7800/api/console/health`
- OpenAPI JSON: `http://127.0.0.1:7800/openapi.json` 或 `http://<本机IP>:7800/openapi.json`
- API Docs: `http://127.0.0.1:7800/docs` 或 `http://<本机IP>:7800/docs`
- Plugin Runner Health: `http://127.0.0.1:7801/health` 或 `http://<本机IP>:7801/health`
