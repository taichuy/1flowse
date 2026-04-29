# Scope
- 作用域：`api/` 及其子目录。
- 下述路径默认相对 `api/`。

## Skills
- 做后端实现、接口、状态流转、分层边界时：使用 `backend-development`
- 做质量评估、回归审计时：使用 `qa-evaluation`

## Directory Rules
按 `api/` 目录树顺序阅读和维护：

- `apps/api-server` 是 Axum HTTP API 宿主，负责 public / console / runtime route、middleware、response、OpenAPI、loader、policy、inventory、infra bootstrap、route mount 与 boot assembly。
- `apps/plugin-runner` 是 RuntimeExtension 运行宿主，不承载控制面业务逻辑。
- `crates/access-control` 放权限目录、内建角色、权限校验。
- `crates/control-plane` 放业务 service、状态写入口、审计入口、repository trait 与外部端口。
- `crates/domain` 放领域模型、作用域语义、稳定核心对象。
- `crates/observability` 放日志、trace 与可观测性基础能力。
- `crates/orchestration-runtime` 放编排编译、绑定运行时、执行引擎、预览执行器。
- `crates/plugin-framework` 放插件 manifest / schema / contribution / registry / package 边界。
- `crates/publish-gateway` 放发布网关边界。
- `crates/runtime-core` 放 runtime registry、runtime CRUD 核心和 slot engine。
- `crates/runtime-profile` 放运行目标、locale、profile fingerprint 与插件运行环境快照。
- `crates/storage-durable` 放平台主存储边界、主存储启动入口与健康检查入口；宿主只消费这里暴露的稳定入口。
- `crates/storage-durable/postgres` 是 `storage-postgres` crate，放 PostgreSQL repository impl、查询、事务、migrations、存储层 mapper。
- `crates/storage-ephemeral` 放非持久 session store、短期协同原语与 ephemeral backend 适配。
- `crates/storage-object` 放业务文件对象存储 driver 边界；内建 `local` 与 `rustfs` driver。
- `plugins` 是插件源码工作区和包工作区；`host-extensions`、`sets`、`templates`、`packages`、`installed` 的生命周期以 `api/plugins/README.md` 为准。
- `target` 是构建产物目录，不手工修改。
- 模块级与单元测试放到对应 `src/_tests`；应用宿主级健康检查、启动冒烟、跨 crate 集成验证放到 `tests/`。
- 同一目录文件接近 `15` 个时收纳子目录；单文件接近 `1500` 行时拆职责。

## Local Truths
- `apps/api-server/src/routes` 是协议层：参数解析、上下文提取、调用 service / action、响应与错误映射、OpenAPI 暴露。
- `apps/api-server/src/middleware` 是请求链路约束层。
- `crates/control-plane` 是业务边界；关键写动作从命名明确的 service command 或 `Resource Action Kernel` action 进入。
- `crates/control-plane/src/ports` 定义 repository trait 与外部端口。
- `crates/storage-durable/postgres/src/**/*_repository.rs` 和 `crates/storage-ephemeral/src/*` 是存储或短期协同端口实现。
- actor / scope 过滤型查询属于持久化查询职责；状态流转、权限决策、审计写入属于 `control-plane`。
- `crates/storage-durable/postgres/src/mappers` 是存储模型与领域模型转换层。
- 主仓 durable 后端官方支持 PostgreSQL；外部数据库、SaaS、API 数据源走 runtime extension。
- 业务文件二进制走 `storage-object`；插件安装包和业务文件属于不同存储域。
- 默认本地业务文件根目录是 `api/storage`；`rustfs` driver 内建但不默认启用。
- `file_storages` 是 `root/system` 资源；`workspace` 创建和消费可见 `file_tables`。
- 存储配置与文件表存储绑定归 `root/system` 管理。
- 文件记录保存实际 `storage_id`；文件表改绑只影响后续新上传。
- session 显式持有 `tenant_id` 与 `current_workspace_id`。
- 登录结果、session 读取与请求中间件继续向下传递 `current_workspace_id`。
- 单个请求链路落在一个显式 `workspace` 上下文。
- `root/system` 与业务 `workspace` 是不同命名面；外部接口与业务语义统一使用 `workspace`。
- 数据建模定义的 `scope_kind` 是 `workspace` 或 `system`；`system` 使用 `SYSTEM_SCOPE_ID`。
- runtime 物理 scope 列统一使用 `scope_id`；活跃后端代码不保留 `team/app` alias、`team_id` 或 `app_id` 语义。
- `Boot Core` 负责启动、加载、deployment policy、root/system bootstrap、extension inventory、health/reconcile。
- `HostExtension` 是 system/root 级可信 host 模块，可定义、替换、增强 host contract；v1 是 trusted native in-process、boot-time activated、restart-scoped。
- `RuntimeExtension` 实现已注册 runtime slot，例如 `model_provider`、`data_source`、`file_processor`。
- `CapabilityPlugin` 贡献 workspace 用户显式选择的能力，例如 canvas node、tool、trigger、publisher。
- `provider`、`data source`、`file processor` 不是插件主类型，分别是 runtime slot 或 host capability。
- `storage-durable`、`storage-ephemeral`、`storage-object` 是 host contract / implementation kind。
- `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` 是宿主基础设施 contract；Redis、NATS、RabbitMQ 等实现是 HostExtension provider。
- `API_EPHEMERAL_BACKEND=redis` 不是目标架构；Core 不通过 env 分支直接选择 Redis session store。
- data-source runtime extension 负责配置校验、连接测试、catalog/schema 发现、预览读取和导入快照输出；权限、secret、preview session、import job 与落盘由宿主和 `data-source-platform` 编排。

## When / Then Rules
- When 新增或修改 HTTP route, then route 只做协议适配；状态变化进入 service command 或 `Resource Action Kernel` action。
- When 修改 middleware, then middleware 只处理请求链路约束；不写业务状态。
- When 新增关键写动作, then 同步设计 service/action 入口、权限、审计、幂等和回归测试。
- When 修改成员、角色、权限、模型或会话关键动作, then 写审计日志。
- When 写动作影响 session 安全边界, then 经过显式 service；when 该接口需要 CSRF 保护, then 校验 `x-csrf-token`。
- When 新 Core 写动作要成为 HostExtension 扩展点, then 先进入 `Resource Action Kernel`；未进入 kernel 的 route 不是 HostExtension hook 扩展点。
- When HostExtension 实现或增强 host contract, then manifest 声明 contribution；native entrypoint 只注册已声明的 resource、action、hook、route、worker、migration 和 infrastructure provider。
- When HostExtension 启停或升级, then 写 desired state；实际激活在重启后生效；Rust native `so/dll` 热卸载不是 v1 目标。
- When HostExtension 写 migration, then 使用 `ext_<normalized_extension_id>__*` 命名空间；不修改 Core 真值表。
- When pre-state infra provider bootstrap 运行, then 它发生在 `ApiState`、session store、control-plane service、runtime engine 和 HTTP router 构造前。
- When workspace / tenant 消费宿主能力, then 只配置、绑定或消费宿主已安装能力。
- When runtime extension 绑定目标, then 目标是 `workspace` 或 `model`。
- When RuntimeExtension 实现 slot, then 保持在已注册 runtime slot 内；不注册 HTTP 接口、resource、auth provider，也不直接写平台主存储。
- When CapabilityPlugin 贡献能力, then 只进入 workspace 用户显式选择的能力面；不注册系统接口。
- When runtime 模型或字段缺少物理表 / 列, then 标记不可用；不健康元数据不进入 runtime registry。
- When data-source plugin 接入外部数据库、SaaS 或 API, then 它走 runtime extension；不注册 HTTP 接口，不直接写平台数据库，不自管 OAuth callback。
- When 命名 storage 边界, then 保持 `storage-durable`、`storage-ephemeral`、`storage-object`；不改名为 cache，不新增 `Driver` 层级。
- When 需要存储层结构转换, then 新增 mapper；否则不要为凑结构拆空文件。
- When 新增测试, then 放入对应 `_tests` 子目录。

## Verification
- When 进入自检、验收、回归或交付阶段, then 使用 `qa-evaluation` 并执行对应脚本。
- When 新增后端功能, then QA 结论覆盖 service 测试与 route 测试。
- When 同一工作区执行 `cargo` 验证命令, then 串行执行，不并发抢锁。
- When 修改 `storage-durable/postgres/migrations` 下历史 migration 文件, then 数据库测试优先使用独立 schema，避免 `sqlx` migration checksum 污染共享 schema。
- `storage-durable/postgres/migrations` 是顺序追加的历史迁移链，允许超过单目录 15 文件规则。
- When 在 `storage-durable/postgres/src`、`storage-durable/postgres/src/_tests` 或 `apps/api-server/src/_tests` 新增大块代码, then 优先收纳子目录，不继续扩大根层平铺。

## 新增资源最低模板
When 新增关键写资源, then 至少包含：

- `apps/api-server/src/routes/<resource>.rs`
- `crates/control-plane/src/<resource>.rs` 或 `crates/control-plane/src/<resource>/mod.rs`
- `crates/control-plane/src/ports/<resource>.rs` 中对应的 repository trait
- `crates/storage-durable/postgres/src/<resource>_repository.rs` 或 `crates/storage-ephemeral/src/<resource>_repository.rs`
- 对应 `_tests`

`dto` 可定义在 route 模块内；`storage-durable/postgres/migrations` 只放数据库迁移。
