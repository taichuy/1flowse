# 1Flowse

## Repo Layout

- `web/`: 前端根目录，`pnpm + Turbo` workspace，应用入口在 `web/app`，共享包在 `web/packages/*`
- `api/`: 后端根目录，Rust workspace，服务入口在 `api/apps/*`，共享 crate 在 `api/crates/*`
- `docker/`: 本地中间件与容器编排

前端命令在 `web/` 下执行，后端命令在 `api/` 下执行，不再把对应工具链放在仓库根目录。

## Bootstrap Quick Start

### Unified Dev Script

```bash
node scripts/node/dev-up.js
```

常用命令：

```bash
node scripts/node/dev-up.js
node scripts/node/dev-up.js --skip-docker
node scripts/node/dev-up.js restart --frontend-only
node scripts/node/dev-up.js restart --backend-only
node scripts/node/dev-up.js status
node scripts/node/dev-up.js stop
```

说明：

- 默认全量管理前端、`api-server`、`plugin-runner`，并在全量动作下管理 `docker/docker-compose.middleware.yaml`
- `--skip-docker` 只跳过 Docker 中间件，不影响前后端本地进程
- `--frontend-only` 只管理前端
- `--backend-only` 只管理 `api-server` 与 `plugin-runner`
- 日志写入 `tmp/logs/`
- pid 记录写入 `tmp/dev-up/pids/`

### Frontend

```bash
cd web
pnpm install
pnpm dev
```

前端默认监听 `0.0.0.0:3100`，可通过本机或局域网地址访问。

### Mock UI Sandbox

```bash
node scripts/node/mock-ui-sync.js
```

该命令会先清空 `tmp/mock-ui/`，再把 `web/` 重建到这里，并把 mock 副本的前端默认端口改成 `3210`。

### Backend

```bash
cd api
cargo run -p api-server
cargo run -p plugin-runner
```

后端默认地址：

- `api-server`: `0.0.0.0:7800`
- `plugin-runner`: `0.0.0.0:7801`

### Middleware

```bash
docker compose -f docker/docker-compose.middleware.yaml up -d
```

## Verification

### Frontend

```bash
cd web
pnpm lint
pnpm test
pnpm build
```

### Backend

```bash
cd api
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

## Local URLs

- Web: `http://127.0.0.1:3100` 或 `http://<本机IP>:3100`
- API Health: `http://127.0.0.1:7800/health` 或 `http://<本机IP>:7800/health`
- Console Health: `http://127.0.0.1:7800/api/console/health` 或 `http://<本机IP>:7800/api/console/health`
- OpenAPI JSON: `http://127.0.0.1:7800/openapi.json` 或 `http://<本机IP>:7800/openapi.json`
- API Docs: `http://127.0.0.1:7800/docs` 或 `http://<本机IP>:7800/docs`
- Plugin Runner Health: `http://127.0.0.1:7801/health` 或 `http://<本机IP>:7801/health`
