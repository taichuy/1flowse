# Dify 前端测试 Mock 指南

## ⚠️ 重要：不要 Mock 什么

### 不要 Mock 基础组件

**切勿 Mock 来自 `@/app/components/base/` 的组件**，例如：

- `Loading`, `Spinner`
- `Button`, `Input`, `Select`
- `Tooltip`, `Modal`, `Dropdown`
- `Icon`, `Badge`, `Tag`

**为什么？**

- 基础组件将有自己专门的测试
- Mock 它们会产生误报（测试通过但实际集成失败）
- 使用真实组件测试实际集成行为

```typescript
// ❌ WRONG: Don't mock base components
// ❌ 错误：不要 Mock 基础组件
vi.mock('@/app/components/base/loading', () => () => <div>Loading</div>)
vi.mock('@/app/components/base/button', () => ({ children }: any) => <button>{children}</button>)

// ✅ CORRECT: Import and use real base components
// ✅ 正确：导入并使用真实基础组件
import Loading from '@/app/components/base/loading'
import Button from '@/app/components/base/button'
// They will render normally in tests
// 它们将在测试中正常渲染
```

### 要 Mock 什么

仅 Mock 这些类别：

1. **API 服务** (`@/service/*`) - 网络调用
1. **复杂的上下文提供者** - 当设置太困难时
1. **具有副作用的第三方库** - `next/navigation`、外部 SDK
1. **i18n** - 始终 Mock 以返回键

### Zustand Stores - 不要手动 Mock

**Zustand 在 `web/vitest.setup.ts` 中被全局 Mock**。使用带有 `setState()` 的真实 store：

```typescript
// ✅ CORRECT: Use real store, set test state
// ✅ 正确：使用真实 store，设置测试状态
import { useAppStore } from '@/app/components/app/store'

useAppStore.setState({ appDetail: { id: 'test', name: 'Test' } })
render(<MyComponent />)

// ❌ WRONG: Don't mock the store module
// ❌ 错误：不要 Mock store 模块
vi.mock('@/app/components/app/store', () => ({ ... }))
```

有关完整详细信息，请参阅 [Zustand Store 测试](#zustand-store-testing) 部分。

## Mock 放置位置

| 位置 | 用途 |
|----------|---------|
| `web/vitest.setup.ts` | 所有测试共享的全局 Mock (`react-i18next`, `next/image`, `zustand`) |
| `web/__mocks__/zustand.ts` | Zustand Mock 实现（每次测试后自动重置 store） |
| `web/__mocks__/` | 跨多个测试文件共享的可重用 Mock 工厂 |
| 测试文件 | 测试特定的 Mock，与 `vi.mock()` 内联 |

模块不会自动 Mock。在测试文件中使用 `vi.mock`，或在 `web/vitest.setup.ts` 中添加全局 Mock。

**注意**：Zustand 很特殊 - 它是全局 Mock 的，但不应手动 Mock store 模块。参见 [Zustand Store 测试](#zustand-store-testing)。

## 基本 Mocks

### 1. i18n (通过全局 Mock 自动加载)

全局 Mock 在 `web/vitest.setup.ts` 中定义，并由 Vitest 设置自动加载。

全局 Mock 提供：

- `useTranslation` - 返回带有命名空间前缀的翻译键
- `Trans` 组件 - 渲染 i18nKey 和组件
- `useMixedTranslation` (来自 `@/app/components/plugins/marketplace/hooks`)
- `useGetLanguage` (来自 `@/context/i18n`) - 返回 `'en-US'`

**默认行为**：大多数测试应使用全局 Mock（无需本地覆盖）。

**对于自定义翻译**：使用来自 `@/test/i18n-mock` 的辅助函数：

```typescript
import { createReactI18nextMock } from '@/test/i18n-mock'

vi.mock('react-i18next', () => createReactI18nextMock({
  'my.custom.key': 'Custom translation',
  'button.save': 'Save',
}))
```

**避免**：手动定义仅返回键的 `useTranslation` Mock - 全局 Mock 已经这样做了。

### 2. Next.js Router

```typescript
const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/current-path',
  useSearchParams: () => new URLSearchParams('?key=value'),
}))

describe('Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should navigate on click', () => {
    render(<Component />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/expected-path')
  })
})
```

### 2.1 `nuqs` 查询状态 (首选: Testing Adapter)

对于验证 URL 查询行为的测试，使用 `NuqsTestingAdapter` 而不是直接 Mock `nuqs`。

```typescript
import { renderHookWithNuqs } from '@/test/nuqs-testing'

it('should sync query to URL with push history', async () => {
  const { result, onUrlUpdate } = renderHookWithNuqs(() => useMyQueryState(), {
    searchParams: '?page=1',
  })

  act(() => {
    result.current.setQuery({ page: 2 })
  })

  await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
  const update = onUrlUpdate.mock.calls[onUrlUpdate.mock.calls.length - 1][0]
  expect(update.options.history).toBe('push')
  expect(update.searchParams.get('page')).toBe('2')
})
```

仅当 URL 同步有意超出范围时，才使用直接 `vi.mock('nuqs')`。

### 3. Portal 组件 (具有共享状态)

```typescript
// ⚠️ Important: Use shared state for components that depend on each other
// ⚠️ 重要：对相互依赖的组件使用共享状态
let mockPortalOpenState = false

vi.mock('@/app/components/base/portal-to-follow-elem', () => ({
  PortalToFollowElem: ({ children, open, ...props }: any) => {
    mockPortalOpenState = open || false  // Update shared state (更新共享状态)
    return <div data-testid="portal" data-open={open}>{children}</div>
  },
  PortalToFollowElemContent: ({ children }: any) => {
    // ✅ Matches actual: returns null when portal is closed
    // ✅ 匹配实际：当 portal 关闭时返回 null
    if (!mockPortalOpenState) return null
    return <div data-testid="portal-content">{children}</div>
  },
  PortalToFollowElemTrigger: ({ children }: any) => (
    <div data-testid="portal-trigger">{children}</div>
  ),
}))

describe('Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPortalOpenState = false  // ✅ Reset shared state (重置共享状态)
  })
})
```

### 4. API 服务 Mocks

```typescript
import * as api from '@/service/api'

vi.mock('@/service/api')

const mockedApi = vi.mocked(api)

describe('Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock implementation
    // 设置默认 Mock 实现
    mockedApi.fetchData.mockResolvedValue({ data: [] })
  })

  it('should show data on success', async () => {
    mockedApi.fetchData.mockResolvedValue({ data: [{ id: 1 }] })
    
    render(<Component />)
    
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('should show error on failure', async () => {
    mockedApi.fetchData.mockRejectedValue(new Error('Network error'))
    
    render(<Component />)
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
```

### 5. 使用 Nock 进行 HTTP Mocking

```typescript
import nock from 'nock'

const GITHUB_HOST = 'https://api.github.com'
const GITHUB_PATH = '/repos/owner/repo'

const mockGithubApi = (status: number, body: Record<string, unknown>, delayMs = 0) => {
  return nock(GITHUB_HOST)
    .get(GITHUB_PATH)
    .delay(delayMs)
    .reply(status, body)
}

describe('GithubComponent', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('should display repo info', async () => {
    mockGithubApi(200, { name: 'dify', stars: 1000 })
    
    render(<GithubComponent />)
    
    await waitFor(() => {
      expect(screen.getByText('dify')).toBeInTheDocument()
    })
  })

  it('should handle API error', async () => {
    mockGithubApi(500, { message: 'Server error' })
    
    render(<GithubComponent />)
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
```

### 6. Context Providers

```typescript
import { ProviderContext } from '@/context/provider-context'
import { createMockProviderContextValue, createMockPlan } from '@/__mocks__/provider-context'

describe('Component with Context', () => {
  it('should render for free plan', () => {
    const mockContext = createMockPlan('sandbox')
    
    render(
      <ProviderContext.Provider value={mockContext}>
        <Component />
      </ProviderContext.Provider>
    )
    
    expect(screen.getByText('Upgrade')).toBeInTheDocument()
  })

  it('should render for pro plan', () => {
    const mockContext = createMockPlan('professional')
    
    render(
      <ProviderContext.Provider value={mockContext}>
        <Component />
      </ProviderContext.Provider>
    )
    
    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument()
  })
})
```

### 7. React Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}
```

## Mock 最佳实践

### ✅ DO

1. **使用真实基础组件** - 直接从 `@/app/components/base/` 导入
1. **使用真实项目组件** - 优先导入而不是 Mock
1. **使用真实 Zustand stores** - 通过 `store.setState()` 设置测试状态
1. **在 `beforeEach` 中重置 Mock**，而不是 `afterEach`
1. **在 Mock 中匹配实际组件行为**（当必须 Mock 时）
1. **使用工厂函数** 获取复杂 Mock 数据
1. **导入实际类型** 以确保类型安全
1. **在 `beforeEach` 中重置共享 Mock 状态**

### ❌ DON'T

1. **不要 Mock 基础组件** (`Loading`, `Button`, `Tooltip` 等)
1. **不要 Mock Zustand store 模块** - 使用带有 `setState()` 的真实 store
1. 不要 Mock 可以直接导入的组件
1. 不要创建错过条件逻辑的过度简化的 Mock
1. 不要忘记在每次测试后清理 nock
1. 没有必要时不要在 Mock 中使用 `any` 类型

### Mock 决策树

```
Need to use a component in test? (需要在测试中使用组件？)
│
├─ Is it from @/app/components/base/*? (它来自 @/app/components/base/* 吗？)
│  └─ YES → Import real component, DO NOT mock (是的 → 导入真实组件，不要 Mock)
│
├─ Is it a project component? (它是项目组件吗？)
│  └─ YES → Prefer importing real component (是的 → 优先导入真实组件)
│           Only mock if setup is extremely complex (仅当设置极其复杂时才 Mock)
│
├─ Is it an API service (@/service/*)? (它是 API 服务 (@/service/*) 吗？)
│  └─ YES → Mock it (是的 → Mock 它)
│
├─ Is it a third-party lib with side effects? (它是具有副作用的第三方库吗？)
│  └─ YES → Mock it (next/navigation, external SDKs) (是的 → Mock 它)
│
├─ Is it a Zustand store? (它是 Zustand store 吗？)
│  └─ YES → DO NOT mock the module! (是的 → 不要 Mock 模块！)
│           Use real store + setState() to set test state (使用真实 store + setState() 设置测试状态)
│           (Global mock handles auto-reset) (全局 Mock 处理自动重置)
│
└─ Is it i18n? (它是 i18n 吗？)
   └─ YES → Uses shared mock (auto-loaded). Override only for custom translations (是的 → 使用共享 Mock（自动加载）。仅覆盖自定义翻译)
```

## Zustand Store 测试

### 全局 Zustand Mock (自动加载)

Zustand 遵循 [官方 Zustand 测试指南](https://zustand.docs.pmnd.rs/guides/testing) 在 `web/vitest.setup.ts` 中被全局 Mock。`web/__mocks__/zustand.ts` 中的 Mock 提供：

- 具有 `getState()`, `setState()`, `subscribe()` 方法的真实 store 行为
- 每次测试后通过 `afterEach` 自动重置 store
- 测试之间适当的测试隔离

### ✅ 推荐：使用真实 Stores (官方最佳实践)

**不要手动 Mock store 模块。** 导入并使用真实 store，然后使用 `setState()` 设置测试状态：

```typescript
// ✅ CORRECT: Use real store with setState
// ✅ 正确：使用带有 setState 的真实 store
import { useAppStore } from '@/app/components/app/store'

describe('MyComponent', () => {
  it('should render app details', () => {
    // Arrange: Set test state via setState
    // Arrange: 通过 setState 设置测试状态
    useAppStore.setState({
      appDetail: {
        id: 'test-app',
        name: 'Test App',
        mode: 'chat',
      },
    })

    // Act
    render(<MyComponent />)

    // Assert
    expect(screen.getByText('Test App')).toBeInTheDocument()
    // Can also verify store state directly
    // 也可以直接验证 store 状态
    expect(useAppStore.getState().appDetail?.name).toBe('Test App')
  })

  // No cleanup needed - global mock auto-resets after each test
  // 不需要清理 - 全局 Mock 在每次测试后自动重置
})
```

### ❌ 避免：手动 Store 模块 Mocking

手动 Mocking 与全局 Zustand Mock 冲突并丢失 store 功能：

```typescript
// ❌ WRONG: Don't mock the store module
// ❌ 错误：不要 Mock store 模块
vi.mock('@/app/components/app/store', () => ({
  useStore: (selector) => mockSelector(selector),  // Missing getState, setState! (缺少 getState, setState!)
}))

// ❌ WRONG: This conflicts with global zustand mock
// ❌ 错误：这与全局 zustand mock 冲突
vi.mock('@/app/components/workflow/store', () => ({
  useWorkflowStore: vi.fn(() => mockState),
}))
```

**手动 Mocking 的问题：**

1. 丢失 `getState()`, `setState()`, `subscribe()` 方法
1. 与全局 Zustand Mock 行为冲突
1. 需要手动维护 store API
1. 测试不反映实际的 store 行为

### 何时需要手动 Store Mocking

在极少数情况下，store 具有复杂的初始化或副作用，你可以 Mock 它，但确保提供完整的 store API：

```typescript
// If you MUST mock (rare), include full store API
// 如果你必须 Mock（罕见），包括完整的 store API
const mockStore = {
  appDetail: { id: 'test', name: 'Test' },
  setAppDetail: vi.fn(),
}

vi.mock('@/app/components/app/store', () => ({
  useStore: Object.assign(
    (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
    {
      getState: () => mockStore,
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
  ),
}))
```

### Store 测试决策树

```
Need to test a component using Zustand store? (需要测试使用 Zustand store 的组件？)
│
├─ Can you use the real store? (你能使用真实 store 吗？)
│  └─ YES → Use real store + setState (RECOMMENDED) (是的 → 使用真实 store + setState (推荐))
│           useAppStore.setState({ ... })
│
├─ Does the store have complex initialization/side effects? (Store 有复杂的初始化/副作用吗？)
│  └─ YES → Consider mocking, but include full API (是的 → 考虑 Mock，但包括完整 API)
│           (getState, setState, subscribe)
│
└─ Are you testing the store itself (not a component)? (你在测试 store 本身（不是组件）吗？)
   └─ YES → Test store directly with getState/setState (是的 → 使用 getState/setState 直接测试 store)
            const store = useMyStore
            store.setState({ count: 0 })
            store.getState().increment()
            expect(store.getState().count).toBe(1)
```

### 示例：测试 Store Actions

```typescript
import { useCounterStore } from '@/stores/counter'

describe('Counter Store', () => {
  it('should increment count', () => {
    // Initial state (auto-reset by global mock)
    // 初始状态（由全局 Mock 自动重置）
    expect(useCounterStore.getState().count).toBe(0)

    // Call action
    // 调用 action
    useCounterStore.getState().increment()

    // Verify state change
    // 验证状态更改
    expect(useCounterStore.getState().count).toBe(1)
  })

  it('should reset to initial state', () => {
    // Set some state
    // 设置一些状态
    useCounterStore.setState({ count: 100 })
    expect(useCounterStore.getState().count).toBe(100)

    // After this test, global mock will reset to initial state
    // 此测试后，全局 Mock 将重置为初始状态
  })
})
```

## 工厂函数模式

```typescript
// __mocks__/data-factories.ts
import type { User, Project } from '@/types'

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'member',
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  name: 'Test Project',
  description: 'A test project',
  owner: createMockUser(),
  members: [],
  createdAt: new Date().toISOString(),
  ...overrides,
})

// Usage in tests
// 在测试中使用
it('should display project owner', () => {
  const project = createMockProject({
    owner: createMockUser({ name: 'John Doe' }),
  })
  
  render(<ProjectCard project={project} />)
  expect(screen.getByText('John Doe')).toBeInTheDocument()
})
```
