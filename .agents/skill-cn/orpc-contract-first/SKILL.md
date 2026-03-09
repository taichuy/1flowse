---
name: orpc-contract-first
description: Dify 前端实现 oRPC 契约优先 (Contract-First) API 模式的指南。适用于在 web/contract 中创建或更新契约、编排路由组合、集成 TanStack Query 与类型化契约、将旧版服务调用迁移到 oRPC，或决定是直接调用 queryOptions 还是提取辅助函数/use-* Hook。
---

# oRPC 契约优先开发 (Contract-First Development)

## 意图 (Intent)

- 将契约作为 `web/contract/*` 中的单一事实来源。
- 默认查询用法：当端点行为与契约 1:1 映射时，在调用点直接使用 `useQuery(consoleQuery|marketplaceQuery.xxx.queryOptions(...))`。
- 保持抽象最小化并保留 TypeScript 类型推断。

## 最小结构 (Minimal Structure)

```text
web/contract/
├── base.ts
├── router.ts
├── marketplace.ts
└── console/
    ├── billing.ts
    └── ...other domains
web/service/client.ts
```

## 核心工作流 (Core Workflow)

1. 在 `web/contract/console/{domain}.ts` 或 `web/contract/marketplace.ts` 中定义契约
   - 使用 `base.route({...}).output(type<...>())` 作为基准。
   - 仅当请求包含 `params/query/body` 时添加 `.input(type<...>())`。
   - 对于没有输入的 `GET` 请求，省略 `.input(...)`（不要使用 `.input(type<unknown>())`）。
2. 在 `web/contract/router.ts` 中注册契约
   - 直接从领域文件导入并按 API 前缀嵌套。
3. 通过 oRPC 查询工具在 UI 调用点使用。

```typescript
import { useQuery } from '@tanstack/react-query'
import { consoleQuery } from '@/service/client'

const invoiceQuery = useQuery(consoleQuery.billing.invoices.queryOptions({
  staleTime: 5 * 60 * 1000,
  throwOnError: true,
  select: invoice => invoice.url,
}))
```

## 查询使用决策规则 (Query Usage Decision Rule)

1. **默认**：调用点直接使用 `*.queryOptions(...)`。
2. 如果 3 个以上调用点共享相同的额外选项（例如 `retry: false`），提取一个小的 `queryOptions` 辅助函数，而不是 `use-*` 透传 Hook。
3. 仅在编排时创建 `web/service/use-{domain}.ts`：
   - 组合多个查询/突变。
   - 共享领域级派生状态或失效辅助函数。

```typescript
const invoicesBaseQueryOptions = () =>
  consoleQuery.billing.invoices.queryOptions({ retry: false })

const invoiceQuery = useQuery({
  ...invoicesBaseQueryOptions(),
  throwOnError: true,
})
```

## 突变使用决策规则 (Mutation Usage Decision Rule)

1. **默认**：调用 `consoleQuery` / `marketplaceQuery` 中的突变辅助函数，例如 `useMutation(consoleQuery.billing.bindPartnerStack.mutationOptions(...))`。
2. 如果突变流程高度定制，使用 oRPC 客户端作为 `mutationFn`（例如 `consoleClient.xxx` / `marketplaceClient.xxx`），而不是手写通用的非 oRPC 突变逻辑。

## 关键 API 指南 (`.key` vs `.queryKey` vs `.mutationKey`)

- `.key(...)`:
  - 用于部分匹配操作（推荐用于失效/重新获取/取消模式）。
  - 示例：`queryClient.invalidateQueries({ queryKey: consoleQuery.billing.key() })`
- `.queryKey(...)`:
  - 用于特定查询的完整键（精确查询标识 / 直接缓存寻址）。
- `.mutationKey(...)`:
  - 用于特定突变的完整键。
  - 典型用例：突变默认值注册、突变状态过滤（`useIsMutating`, `queryClient.isMutating`）或显式开发者工具分组。

## 反模式 (Anti-Patterns)

- 不要用 `options?: Partial<UseQueryOptions>` 包装 `useQuery`。
- 当 oRPC `queryOptions` 已经存在且符合用例时，不要拆分本地 `queryKey/queryFn`。
- 不要为单个端点创建薄薄的 `use-*` 透传 Hook。
- **原因**：这些模式会降低推断能力（`data` 可能变成 `unknown`，尤其是在 `throwOnError`/`select` 周围），并增加不必要的间接层。

## 契约规则 (Contract Rules)

- **输入结构**：始终使用 `{ params, query?, body? }` 格式
- **无输入 GET**：省略 `.input(...)`；不要使用 `.input(type<unknown>())`
- **路径参数**：在路径中使用 `{paramName}`，在 `params` 对象中匹配
- **路由嵌套**：按 API 前缀分组（例如 `/billing/*` -> `billing: {}`）
- **无桶文件**：直接从特定文件导入
- **类型**：从 `@/types/` 导入，使用 `type<T>()` 辅助函数
- **突变**：首选 `mutationOptions`；使用显式 `mutationKey` 主要用于默认值/过滤/开发者工具

## 类型导出 (Type Export)

```typescript
export type ConsoleInputs = InferContractRouterInputs<typeof consoleRouterContract>
```
