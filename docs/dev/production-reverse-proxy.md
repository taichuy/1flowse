# 生产环境反向代理与部署契约 (Production Reverse Proxy)

在 7Flows 的生产环境部署中，为了彻底避免前端与后端的跨域问题 (CORS) 并提供统一的对外服务入口，我们采用**同源反向代理 (Same-Origin Reverse Proxy)** 架构。

这一生产部署契约与本地开发环境的拓扑结构保持严格一致：在本地开发中，`scripts/dev-up.js` 启动了一个轻量级代理服务监听在 `3100` 端口，模拟了生产环境的网关层行为。

## 核心路由分发规则 (Routing Rules)

无论是基于物理机、Docker Compose 还是 Kubernetes 部署，代理网关层都必须遵循以下路径前缀路由契约：

| 路径匹配 (Path Prefix) | 目标服务 (Target Service) | 默认监听端口 | 说明 |
| :--- | :--- | :--- | :--- |
| `/api/` | Backend (FastAPI/Python) | `8000` | 7Flows 内部业务控制面与管理 API |
| `/v1/` | Backend (FastAPI/Python) | `8000` | OpenAI 兼容接口及供外部 Agent 调用的标准 API |
| `/` (Fallback) | Web (Next.js/React) | `3000` | 工作台 UI、编辑器、面板及静态资源 |

---

## 示例一：Nginx 配置参考

如果是基于 Nginx 裸机或标准容器部署，可参考以下 `nginx.conf` 核心配置：

```nginx
upstream frontend {
    # 替换为实际的前端服务地址或容器名
    server localhost:3000;
}

upstream backend {
    # 替换为实际的后端服务地址或容器名
    server localhost:8000;
}

server {
    listen 80;
    server_name your-7flows-domain.com;

    # 优化 WebSocket 连接和代理标头
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 1. 路由业务 API
    location /api/ {
        proxy_pass http://backend;
        # 视情况可能需要 rewrite /api/(.*) /$1 break; （取决于 FastAPI 内部是否配置了 root_path）
        # 当前 7Flows 后端默认直接处理带 /api 的路径
    }

    # 2. 路由 OpenAI 兼容接口 /v1
    location /v1/ {
        proxy_pass http://backend;
    }

    # 3. 默认回退至 Next.js 前端服务
    location / {
        proxy_pass http://frontend;
    }
}
```

## 示例二：Traefik (Docker Compose) 配置参考

如果使用 Docker Compose 并以 Traefik 作为边缘路由器（Edge Router），可以使用 Labels 声明路由契约：

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080" # Traefik Dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  backend:
    build: ./api
    # ... 后端其他配置 ...
    labels:
      - "traefik.enable=true"
      # 匹配 /api/ 或 /v1/ 前缀
      - "traefik.http.routers.7flows-backend.rule=PathPrefix(`/api`) || PathPrefix(`/v1`)"
      - "traefik.http.routers.7flows-backend.entrypoints=web"
      - "traefik.http.services.7flows-backend.loadbalancer.server.port=8000"

  web:
    build: ./web
    # ... 前端其他配置 ...
    labels:
      - "traefik.enable=true"
      # 兜底匹配其他所有前端路由
      - "traefik.http.routers.7flows-web.rule=PathPrefix(`/`)"
      - "traefik.http.routers.7flows-web.entrypoints=web"
      # 注意：配置较低的优先级，使得 /api 和 /v1 优先被后端拦截
      - "traefik.http.routers.7flows-web.priority=10"
      - "traefik.http.services.7flows-web.loadbalancer.server.port=3000"
```

## 部署注意事项

1. **WebSocket 支持**：工作流在执行态时可能会通过长链接 (SSE 或 WebSocket) 进行 Trace 和日志流推送。确保反向代理层（如 Nginx 的 `Connection 'upgrade'` 配置）未拦截这些长连接，且设置了合理的超时时间 (`proxy_read_timeout`)。
2. **Body 限制**：如允许用户上传大型文档进行知识库解析，需要在代理层相应上调客户端 Body 的最大限制（如 Nginx 的 `client_max_body_size 50M;`）。