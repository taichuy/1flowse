---
name: frontend-testing
description: 为 Dify 前端组件、Hook 和工具函数生成 Vitest + React Testing Library 测试。在测试、spec 文件、覆盖率、Vitest、RTL、单元测试、集成测试或编写/审查测试请求时触发。
---

# Dify 前端测试技能

此技能使 Claude 能够遵循既定约定和最佳实践，为 Dify 项目生成高质量、全面的前端测试。

> **⚠️ 权威来源**：此技能源自 `web/docs/test.md`。使用 Vitest mock/timer APIs (`vi.*`)。

## 何时应用此技能

当用户执行以下操作时应用此技能：

- 要求为组件、Hook 或工具函数 **编写测试**
- 要求 **审查现有测试** 的完整性
- 提到 **Vitest**、**React Testing Library**、**RTL** 或 **spec 文件**
- 请求 **测试覆盖率** 改进
- 使用 `pnpm analyze-component` 输出作为上下文
- 提到前端代码的 **测试**、**单元测试** 或 **集成测试**
- 想要了解 Dify 代码库中的 **测试模式**

**不要应用** 当：

- 用户询问后端/API 测试 (Python/pytest)
- 用户询问 E2E 测试 (Playwright/Cypress)
- 用户仅询问概念性问题而没有代码上下文

## 快速参考

### 技术栈

| 工具 | 版本 | 用途 |
|------|---------|---------|
| Vitest | 4.0.16 | 测试运行器 |
| React Testing Library | 16.0 | 组件测试 |
| jsdom | - | 测试环境 |
| nock | 14.0 | HTTP mocking |
| TypeScript | 5.x | 类型安全 |

### 关键命令

```bash
# 运行所有测试
pnpm test

# 监视模式
pnpm test:watch

# 运行特定文件
pnpm test path/to/file.spec.tsx

# 生成覆盖率报告
pnpm test:coverage

# 分析组件复杂度
pnpm analyze-component <path>

# 审查现有测试
pnpm analyze-component <path> --review
```

### 文件命名

- 测试文件：`ComponentName.spec.tsx`（与组件在同一目录）
- 集成测试：`web/__tests__/` 目录

## 测试结构模板

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Component from './index'

// ✅ Import real project components (DO NOT mock these)
// ✅ 导入真实项目组件（不要 Mock 这些）
// import Loading from '@/app/components/base/loading'
// import { ChildComponent } from './child-component'

// ✅ Mock external dependencies only
// ✅ 仅 Mock 外部依赖
vi.mock('@/service/api')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/test',
}))

// ✅ Zustand stores: Use real stores (auto-mocked globally)
// ✅ Zustand stores: 使用真实 store（全局自动 Mock）
// Set test state with: useAppStore.setState({ ... })
// 使用 useAppStore.setState({ ... }) 设置测试状态

// Shared state for mocks (if needed)
// Mock 的共享状态（如果需要）
let mockSharedState = false

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()  // ✅ Reset mocks BEFORE each test (在每次测试前重置 Mock)
    mockSharedState = false  // ✅ Reset shared state (重置共享状态)
  })

  // Rendering tests (REQUIRED)
  // 渲染测试（必需）
  describe('Rendering', () => {
    it('should render without crashing', () => {
      // Arrange
      const props = { title: 'Test' }
      
      // Act
      render(<Component {...props} />)
      
      // Assert
      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })

  // Props tests (REQUIRED)
  // Props 测试（必需）
  describe('Props', () => {
    it('should apply custom className', () => {
      render(<Component className="custom" />)
      expect(screen.getByRole('button')).toHaveClass('custom')
    })
  })

  // User Interactions
  // 用户交互
  describe('User Interactions', () => {
    it('should handle click events', () => {
      const handleClick = vi.fn()
      render(<Component onClick={handleClick} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  // Edge Cases (REQUIRED)
  // 边界情况（必需）
  describe('Edge Cases', () => {
    it('should handle null data', () => {
      render(<Component data={null} />)
      expect(screen.getByText(/no data/i)).toBeInTheDocument()
    })

    it('should handle empty array', () => {
      render(<Component items={[]} />)
      expect(screen.getByText(/empty/i)).toBeInTheDocument()
    })
  })
})
```

## 测试工作流（关键）

### ⚠️ 必需的增量方法

**切勿一次性生成所有测试文件。** 对于复杂组件或多文件目录：

1. **分析和计划**：列出所有文件，按复杂度排序（简单 → 复杂）
1. **一次处理一个**：编写测试 → 运行测试 → 如果需要修复 → 下一个
1. **在继续之前验证**：在当前通过之前不要继续到下一个文件

```
对于每个文件:
  ┌────────────────────────────────────────┐
  │ 1. Write test                          │
  │ 1. 编写测试                            │
  │ 2. Run: pnpm test <file>.spec.tsx      │
  │ 2. 运行: pnpm test <file>.spec.tsx     │
  │ 3. PASS? → Mark complete, next file    │
  │ 3. 通过? → 标记完成，下一个文件        │
  │    FAIL? → Fix first, then continue    │
  │    失败? → 先修复，然后继续            │
  └────────────────────────────────────────┘
```

### 基于复杂度的顺序

对于多文件测试，按此顺序处理：

1. 🟢 工具函数（最简单）
1. 🟢 自定义 Hook
1. 🟡 简单组件（展示性）
1. 🟡 中等组件（状态、副作用）
1. 🔴 复杂组件（API、路由）
1. 🔴 集成测试（索引文件 - 最后）

### 何时先重构

- **复杂度 > 50**：在测试前分解成更小的部分
- **500+ 行**：在测试前考虑拆分
- **许多依赖项**：首先将逻辑提取到 Hook 中

> 📖 参见 `references/workflow.md` 获取完整的工作流详细信息和待办事项列表格式。

## 测试策略

### 路径级测试（目录测试）

当分配测试目录/路径时，测试该路径内的 **所有内容**：

- 测试目录中的所有组件、Hook、工具函数（不仅仅是 `index` 文件）
- 使用增量方法：一次一个文件，在继续之前验证每个文件
- 目标：目录中所有文件的 100% 覆盖率

### 优先集成测试

当为目录编写测试时，**优先考虑集成测试**：

- ✅ 直接 **导入真实项目组件**（包括基础组件和兄弟组件）
- ✅ **仅 Mock**：API 服务 (`@/service/*`)、`next/navigation`、复杂的上下文提供者
- ❌ **不要 Mock** 基础组件 (`@/app/components/base/*`)
- ❌ **不要 Mock** 同一目录中的兄弟/子组件

> 参见 [测试结构模板](#test-structure-template) 获取正确的导入/Mock 模式。

### `nuqs` 查询状态测试（URL 状态 Hook 必需）

当组件或 Hook 使用 `useQueryState` / `useQueryStates` 时：

- ✅ 使用 `NuqsTestingAdapter`（首选 `web/test/nuqs-testing.tsx` 中的共享辅助函数）
- ✅ 通过 `onUrlUpdate` 断言 URL 同步 (`searchParams`, `options.history`)
- ✅ 对于自定义解析器 (`createParser`)，保持 `parse` 和 `serialize` 双射，并添加往返边界情况（`%2F`、`%25`、空格、旧版编码值）
- ✅ 验证默认清除行为（默认值应在适当时从 URL 中删除）
- ⚠️ 仅当 URL 行为明确超出测试范围时，才直接 Mock `nuqs`

## 核心原则

### 1. AAA 模式 (Arrange-Act-Assert)

每个测试都应清楚地分离：

- **Arrange**: 设置测试数据并渲染组件
- **Act**: 执行用户操作
- **Assert**: 验证预期结果

### 2. 黑盒测试

- 测试可观察的行为，而不是实现细节
- 使用语义查询 (getByRole, getByLabelText)
- 避免直接测试内部状态
- **在断言中首选模式匹配而不是硬编码字符串**：

```typescript
// ❌ Avoid: hardcoded text assertions
// ❌ 避免：硬编码文本断言
expect(screen.getByText('Loading...')).toBeInTheDocument()

// ✅ Better: role-based queries
// ✅ 更好：基于角色的查询
expect(screen.getByRole('status')).toBeInTheDocument()

// ✅ Better: pattern matching
// ✅ 更好：模式匹配
expect(screen.getByText(/loading/i)).toBeInTheDocument()
```

### 3. 每个测试单一行为

每个测试验证一个用户可观察的行为：

```typescript
// ✅ Good: One behavior
// ✅ 好：一个行为
it('should disable button when loading', () => {
  render(<Button loading />)
  expect(screen.getByRole('button')).toBeDisabled()
})

// ❌ Bad: Multiple behaviors
// ❌ 坏：多个行为
it('should handle loading state', () => {
  render(<Button loading />)
  expect(screen.getByRole('button')).toBeDisabled()
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  expect(screen.getByRole('button')).toHaveClass('loading')
})
```

### 4. 语义命名

使用 `should <behavior> when <condition>`：

```typescript
it('should show error message when validation fails')
it('should call onSubmit when form is valid')
it('should disable input when isReadOnly is true')
```

## 必需的测试场景

### 始终必需（所有组件）

1. **渲染**：组件渲染不崩溃
1. **Props**：必需 props、可选 props、默认值
1. **边界情况**：null、undefined、空值、边界条件

### 条件（当存在时）

| 功能 | 测试重点 |
|---------|-----------|
| `useState` | 初始状态、转换、清理 |
| `useEffect` | 执行、依赖项、清理 |
| 事件处理程序 | 所有 onClick、onChange、onSubmit、键盘 |
| API 调用 | 加载、成功、错误状态 |
| 路由 | 导航、参数、查询字符串 |
| `useCallback`/`useMemo` | 引用相等性 |
| Context | 提供者值、消费者行为 |
| 表单 | 验证、提交、错误显示 |

## 覆盖率目标（每个文件）

对于生成的每个测试文件，目标是：

- ✅ **100%** 函数覆盖率
- ✅ **100%** 语句覆盖率
- ✅ **>95%** 分支覆盖率
- ✅ **>95%** 行覆盖率

> **注意**：对于多文件目录，每次处理一个文件，每个文件都完全覆盖。参见 `references/workflow.md`。

## 详细指南

有关更多详细信息，请参阅：

- `references/workflow.md` - **增量测试工作流**（多文件测试必读）
- `references/mocking.md` - Mock 模式、Zustand store 测试和最佳实践
- `references/async-testing.md` - 异步操作和 API 调用
- `references/domain-components.md` - 工作流、数据集、配置测试
- `references/common-patterns.md` - 常用测试模式
- `references/checklist.md` - 测试生成检查清单和验证步骤

## 权威参考

### 主要规范（必须遵循）

- **`web/docs/test.md`** - 规范测试规范。此技能源自此文档。

### 代码库中的参考示例

- `web/utils/classnames.spec.ts` - 工具函数测试
- `web/app/components/base/button/index.spec.tsx` - 组件测试
- `web/__mocks__/provider-context.ts` - Mock 工厂示例

### 项目配置

- `web/vitest.config.ts` - Vitest 配置
- `web/vitest.setup.ts` - 测试环境设置
- `web/scripts/analyze-component.js` - 组件分析工具
- 模块不会自动 Mock。全局 Mock 位于 `web/vitest.setup.ts` 中（例如 `react-i18next`, `next/image`）；在测试文件中本地 Mock 其他模块，如 `ky` 或 `mime`。
