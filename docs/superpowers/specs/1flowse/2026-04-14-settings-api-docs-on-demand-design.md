# 1Flowse 设置区 API 文档按接口按需加载设计稿

日期：2026-04-14
状态：已完成设计确认，待用户审阅
关联输入：
- [web/AGENTS.md](../../../../web/AGENTS.md)
- [api/AGENTS.md](../../../../api/AGENTS.md)
- [docs/superpowers/specs/1flowse/2026-04-13-console-shell-auth-settings-design.md](./2026-04-13-console-shell-auth-settings-design.md)
- [web/app/src/features/settings/components/ApiDocsPanel.tsx](../../../../web/app/src/features/settings/components/ApiDocsPanel.tsx)
- [web/app/src/features/settings/pages/SettingsPage.tsx](../../../../web/app/src/features/settings/pages/SettingsPage.tsx)
- [web/app/src/features/settings/lib/settings-sections.tsx](../../../../web/app/src/features/settings/lib/settings-sections.tsx)
- [api/apps/api-server/src/lib.rs](../../../../api/apps/api-server/src/lib.rs)
- [api/apps/api-server/src/openapi.rs](../../../../api/apps/api-server/src/openapi.rs)

## 1. 文档目标

本文档用于冻结 1Flowse 当前设置区 `API 文档` 分区的重构方案，把“后端 Swagger iframe”改为“前端接管、按接口按需加载、受权限控制的内部文档页”。

本轮设计聚焦：

- 保留 `设置 -> API 文档` 作为二级导航入口
- 把文档页改为前端渲染，`Scalar` 仅作为接口详情渲染器
- 后端继续以 `utoipa` 注册平台接口，但不再把完整大文档直接暴露给前端
- 前端先拿接口目录 `catalog`，点击接口后再按需拉取该接口的闭合小型 OpenAPI 文档
- 新增独立文档权限，确保只有管理员或授权账号可以查看内部 API 文档

本轮设计不覆盖：

- 动态建模后的“每个业务模型字段级文档”
- 面向第三方开发者的外部 API 门户
- 在线发请求、调试凭证注入、CSRF 自动透传
- 以“领域分片大 spec”为传输单位的方案

## 2. 当前现状

### 2.1 当前设置页的文档体验只是后端 Swagger 的 iframe

已验证现状：

- 前端 `ApiDocsPanel` 直接渲染 `iframe`
- `iframe` 的地址是 `${apiBaseUrl}/docs`
- `/settings/docs` 只是把后端 `/docs` 嵌进来，而不是前端自有页面

这导致当前文档页的问题不是单纯“样式不好看”，而是控制台没有掌握文档的权限、加载和信息组织。

### 2.2 当前后端把 `/docs` 和 `/openapi.json` 直接挂在基础路由

已验证现状：

- `base_router()` 直接合并 `SwaggerUi::new("/docs").url("/openapi.json", openapi::ApiDoc::openapi())`
- 这意味着当前完整平台 OpenAPI 文档是一个后端统一出口

问题：

- 文档没有独立的权限边界
- 前端不能先拿轻量目录再按需加载详情
- 当平台接口继续增长时，请求体积会继续堆到同一个 JSON 上

### 2.3 当前动态 CRUD 还没有把每个业务模型展开成独立 OpenAPI 路径

已验证现状：

- 当前 runtime 仍然是通用参数化路径，例如 `/api/runtime/models/{model_code}/records`
- `openapi.rs` 里的平台接口仍是静态注册的 `utoipa` paths

这说明当前真正需要解决的是“平台接口文档如何避免越长越大”，而不是现在就去做“每个业务模型一份专属文档”。

## 3. 设计结论

### 3.1 保留 `设置 -> API 文档` 入口，不再使用 iframe

本轮结论：

- `设置` 继续作为后台管理域
- `API 文档` 继续保留为设置区二级导航
- `API 文档` 对应内容区改成前端真实页面，不再嵌后端 `/docs`

这与现有设置区信息架构不冲突。变化的是“内容页如何提供文档体验”，不是“要不要把它赶出设置区”。

### 3.2 不用“领域分片 spec”作为主传输单位

本轮明确拒绝把“按领域拆成 3 份或 5 份完整 spec”作为主方案。

原因：

- 领域分片只能缓解一次性下载的首屏压力
- 它不能真正解决接口数量持续增长后的总体臃肿问题
- 用户的核心目标是“先拿目录，再点接口时按需看详情”，而不是“从一个超大 spec 变成几个中等 spec”

因此本轮采用：

- 传输单位：单接口对应的小型闭合 OpenAPI 文档
- 分组单位：只作为前端目录分组和搜索辅助，不作为加载单位

### 3.3 后端继续维护一个规范来源，前端不维护接口清单真值

本轮固定一条原则：

- 平台接口的文档真值仍来自后端 `utoipa` 注册
- 前端不手写或硬编码接口目录
- 后端从 canonical OpenAPI 派生出两个受保护的消费形态：
  - 轻量接口目录 `catalog`
  - 单接口闭合详情文档 `operation spec`

这样做的好处：

- 后端新增平台接口后，只要完成 `utoipa` 注册，就能自动进入目录和详情链路
- 前端不会出现“页面有目录，但后端文档源忘记同步”的双维护问题

## 4. 信息架构

### 4.1 页面层级

`设置 -> API 文档` 在信息深度上保持为一个 L2 管理页。

页内结构如下：

- 左侧仍是设置区二级导航
- 右侧 `API 文档` 内容区再拆为：
  - 顶部：标题、说明、搜索框、筛选项
  - 中部左栏：接口目录列表
  - 中部右栏：接口详情区

这意味着：

- 设置页的侧边栏负责“哪个设置分区”
- 文档页内部的目录列表只负责“当前分区下选哪个接口”

二者不冲突，也不需要额外提升为新的一级导航。

### 4.2 默认行为

`/settings/docs` 默认只加载目录，不默认加载任何接口详情。

默认空态应展示：

- 当前这是内部平台 API 文档
- 可通过 URL、方法名、标签搜索
- 点击左侧任一接口后，在右侧加载详情

原因：

- 符合“点击接口再查看详情”的交互目标
- 避免页面一进来就发起详情文档请求
- 与未来接口增长后的按需加载策略一致

### 4.3 深链接

当前文档页使用：

- 路径：`/settings/docs`
- 查询参数：`?operation=<operation_id>`

例如：

- `/settings/docs?operation=list_members`

原因：

- 不需要为每个接口生成独立路由定义
- 保留分享和回跳能力
- 便于在同一设置分区内维护选中状态

## 5. 后端设计

### 5.1 Canonical OpenAPI 仍然保留，但不再作为前端主消费出口

本轮后端继续保留一个完整的 canonical OpenAPI 构建过程，来源仍是 `api/apps/api-server/src/openapi.rs`。

变化是：

- canonical OpenAPI 只作为后端内部真值和派生来源
- 前端主链路不再直接请求公开 `/openapi.json`
- 公开 `/docs` 不再作为正式文档入口

### 5.2 新增独立文档权限

新增权限码：

- `api_reference.view.all`

权限语义：

- 允许查看内部平台 API 文档目录和详情

本轮固定规则：

- `root` 永远可见
- 非 `root` 账号必须显式拥有 `api_reference.view.all`

本轮不做：

- 按每条接口再次叠加资源级可见性过滤

原因：

- 第一阶段先把“谁能进文档页”收紧
- 不把文档系统复杂化成“能打开文档页，但每条接口还要逐条裁剪”

### 5.3 新增受保护的文档接口

新增接口：

- `GET /api/console/docs/catalog`
- `GET /api/console/docs/operations/{operation_id}/openapi.json`

两者都必须满足：

- 已登录 session
- `root` 或持有 `api_reference.view.all`

`GET /api/console/docs/catalog` 返回结构：

```json
{
  "data": {
    "title": "1Flowse API",
    "version": "0.1.0",
    "operations": [
      {
        "id": "list_members",
        "method": "GET",
        "path": "/api/console/members",
        "summary": "List members",
        "description": null,
        "tags": ["members"],
        "group": "成员与权限",
        "deprecated": false
      }
    ]
  },
  "meta": null
}
```

字段约束：

- `id`：以后端生成的稳定 operation id 为准，前端视为 opaque string
- `group`：仅用于 UI 分组，不作为文档下载单位
- `summary`、`tags`、`deprecated` 直接来自 OpenAPI 元数据

### 5.4 目录生成方式

目录不单独维护，不额外手写注册表。

生成规则：

1. 从 canonical OpenAPI 读取全部 `paths`
2. 遍历每个 `method + path`
3. 为每个 operation 生成目录项
4. `id` 优先使用 `operationId`
5. 若某 operation 缺少 `operationId`，后端在启动期视为文档构建错误

本轮新增一条质量门禁：

- 平台接口文档必须存在唯一 `operationId`

这样做的目的：

- 让文档详情链接稳定
- 避免“前端靠方法+路径自己拼 key”导致后续路径变更即失效

### 5.5 单接口小型 OpenAPI 文档生成方式

`GET /api/console/docs/operations/{operation_id}/openapi.json` 不返回整份 canonical 文档，而是返回一份对当前 operation 依赖闭合的小型 OpenAPI 文档。

生成步骤：

1. 在 canonical OpenAPI 中按 `operationId` 定位目标 operation
2. 仅保留该 operation 所在 path 下的当前 method
3. 递归收集它引用到的所有 `$ref`
4. 从 canonical `components` 中裁剪出被依赖的条目
5. 保留渲染详情所需的顶层字段：
   - `openapi`
   - `info`
   - `servers`
   - `paths`
   - `components`
   - `tags`（仅保留当前 operation 用到的 tag）

必须被递归收集的引用类别至少包括：

- `components.schemas`
- `components.parameters`
- `components.requestBodies`
- `components.responses`
- `components.headers`
- `components.securitySchemes`
- `components.examples`

本轮目标不是做最小字节级极限裁剪，而是做“可稳定渲染详情的闭合小文档”。

### 5.6 文档构建缓存

当前平台 API 文档是静态注册的，因此后端不应在每次请求时都从零重算目录和小文档。

本轮建议：

- 应用启动后构建一次 canonical OpenAPI
- 懒加载或启动期构建 `catalog`
- 单接口小文档按 `operation_id` 做内存缓存

缓存失效条件：

- 服务重启
- 新版本发布

本轮不引入：

- 外部缓存中间件
- 文档增量更新协议

### 5.7 旧文档出口策略

旧出口：

- `/docs`
- `/openapi.json`

本轮策略：

- 不再作为控制台前端正式入口
- 默认不在生产正式文档链路中暴露给管理员使用

建议落地方式：

- 开发态可保留作为调试入口
- 正式环境应关闭或隐藏

这样能避免出现“两套文档入口同时存在”的长期混乱。

## 6. 前端设计

### 6.1 设置区可见性

`settings-sections.tsx` 中的 `API 文档` 分区不再对所有登录用户可见。

显示规则：

- `root` 可见
- 或当前用户权限包含 `api_reference.view.all`

如果用户没有该权限：

- 不显示 `API 文档` 导航项
- 访问 `/settings/docs` 时按现有 settings fallback 机制回退到其他可见分区

### 6.2 页面结构

`/settings/docs` 页面内容区结构固定为：

- 标题与说明
- 搜索输入框
- 左栏接口目录
- 右栏详情渲染区

左栏每一项至少展示：

- HTTP method
- path
- summary
- deprecated 标记

右栏行为：

- 未选中接口时显示说明空态
- 选中接口后加载对应小型 OpenAPI 文档
- 加载完成后交给 `Scalar` 渲染详情

### 6.3 搜索与筛选

搜索数据源固定来自 `catalog`，而不是详情文档内容。

搜索匹配字段至少包括：

- `path`
- `method`
- `summary`
- `tags`
- `id`

搜索目标：

- 允许用户直接按 URL 关键字查找
- 允许按常见动词或资源名查找

本轮不做：

- 全文检索 request/response schema
- 离线索引

### 6.4 加载策略

页面加载顺序：

1. 打开 `/settings/docs`
2. 请求 `GET /api/console/docs/catalog`
3. 渲染目录和搜索
4. 当用户点击目录项，或 URL 已带 `operation` 参数时
5. 请求 `GET /api/console/docs/operations/{operation_id}/openapi.json`
6. 右侧渲染详情

这条链路保证：

- 初始请求永远是轻量目录
- 详情请求只在用户明确选择接口后发生

### 6.5 Scalar 集成边界

本轮里 `Scalar` 的角色固定为：

- 详情渲染器

不是：

- 整个文档站框架
- 目录、搜索、权限、页面壳层的主导者

这意味着：

- 目录、搜索、空态、错误态由 1Flowse 前端自己实现
- `Scalar` 只负责展示某个接口的小型 OpenAPI 文档

本轮默认策略：

- 只读浏览
- 不开放在线发请求能力
- 不在文档页里处理 cookie、CSRF 或调试态请求注入

## 7. 对现有设计稿的修订

本设计稿明确替换 [2026-04-13-console-shell-auth-settings-design.md](./2026-04-13-console-shell-auth-settings-design.md) 中第 `4.7 API 文档` 小节的旧结论。

旧结论：

- `API 文档` 分区直接内嵌后端 `/docs`，采用 `iframe`

新结论：

- `API 文档` 分区改为前端自有文档页
- 页面先加载接口目录，再按需加载接口详情
- `Scalar` 仅作为右侧详情渲染器

## 8. 验证要求

### 8.1 后端

至少补齐：

- 文档目录路由的未登录、无权限、有权限测试
- 单接口文档路由的未登录、无权限、有权限、`operation_id` 不存在测试
- canonical OpenAPI 中 `operationId` 唯一性测试
- 小型 OpenAPI 文档包含请求体、响应体和共享 schema 的闭合性测试

### 8.2 前端

至少补齐：

- 设置区 `API 文档` 导航显隐测试
- `/settings/docs` 默认空态测试
- 搜索接口目录并选择接口的交互测试
- 选中接口后才发详情请求的测试
- 无文档权限时访问 `/settings/docs` 的回退测试

## 9. 后续演进

本轮架构为后续两类扩展预留统一路径：

- 新增平台静态接口：继续通过后端 `utoipa` 注册进入 canonical OpenAPI，即可自动进入目录和详情链路
- 新增动态模型专属文档：未来可在同一 catalog 协议下增加新的 operation 来源或新的文档注册器，而不用重写前端页面

因此，本轮先解决“平台接口级按需文档”，不提前扩 scope 到“动态模型字段级文档”。
