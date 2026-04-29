# 1flowbase Docker

## 仅启动中间件

```powershell
Copy-Item .\middleware.env.example .\middleware.env
docker compose -f .\docker-compose.middleware.yaml up -d
```

当前默认本地中间件只包含 PostgreSQL。Redis 不作为默认依赖；后续通过 Redis HostExtension / infra plugin 接入。RustFS 不作为默认依赖；对象存储由后台文件存储配置选择，默认使用本地存储。

默认映射端口：

- PostgreSQL: `35432`

`docker/sandbox/config.yaml` 是默认 / reference sandbox backend 的配置模板，后续如果要接代理、限网或更严格隔离，可以直接在这里扩展。它当前更适合作为可选参考执行后端，而不是普通 workflow 开发的硬前置依赖。

## 启动整套容器

```powershell
Copy-Item .\.env.example .\.env
docker compose up -d --build
```

整套容器模式下，`api` 启动前会自动执行数据库迁移。
