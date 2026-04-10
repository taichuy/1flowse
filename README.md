# 1Flowse

## Repo Layout

- `web/`: 前端根目录，`pnpm + Turbo` workspace，应用入口在 `web/app`，共享包在 `web/packages/*`
- `api/`: 后端根目录，Rust workspace，服务入口在 `api/apps/*`，共享 crate 在 `api/crates/*`
- `docker/`: 本地中间件与容器编排

前端命令在 `web/` 下执行，后端命令在 `api/` 下执行，不再把对应工具链放在仓库根目录。

## Bootstrap Quick Start

### Frontend

```bash
cd web
pnpm install
pnpm dev
```

如果本机 `5173` 已被占用，可临时改用：

```bash
cd web
pnpm dev -- --port 5174
```

### Backend

```bash
cd api
cargo run -p api-server
cargo run -p plugin-runner
```

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

- Web: `http://127.0.0.1:5173`
- API Health: `http://127.0.0.1:3000/health`
- Console Health: `http://127.0.0.1:3000/api/console/health`
- OpenAPI JSON: `http://127.0.0.1:3000/openapi.json`
- API Docs: `http://127.0.0.1:3000/docs`
- Plugin Runner Health: `http://127.0.0.1:3001/health`

本机如遇 `5173` 端口冲突，可改用 `http://127.0.0.1:5174` 进行前端联调。
