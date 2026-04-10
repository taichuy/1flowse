# Commands

## Frontend

- `cd web && pnpm install`
- `cd web && pnpm dev`
- `cd web && pnpm dev -- --port 5174`
- `cd web && pnpm lint`
- `cd web && pnpm test`
- `cd web && pnpm build`

## Backend

- `cd api && cargo run -p api-server`
- `cd api && cargo run -p plugin-runner`
- `cd api && cargo fmt --check`
- `cd api && cargo clippy --all-targets --all-features -- -D warnings`
- `cd api && cargo test`

## Local URLs

- Web: `http://127.0.0.1:5173`
- Web fallback: `http://127.0.0.1:5174`
- API Health: `http://127.0.0.1:3000/health`
- Console Health: `http://127.0.0.1:3000/api/console/health`
- OpenAPI JSON: `http://127.0.0.1:3000/openapi.json`
- API Docs: `http://127.0.0.1:3000/docs`
- Plugin Runner Health: `http://127.0.0.1:3001/health`
