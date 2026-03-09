/**
 * React 组件的测试模板
 *
 * 为什么使用这种结构？
 * - 有组织的各个部分使测试易于导航和维护
 * - 顶部的 Mock 确保一致的测试隔离
 * - 工厂函数减少重复并提高可读性
 * - describe 块将相关场景分组，以便更好地调试
 *
 * 说明：
 * 1. 将 `ComponentName` 替换为您的组件名称
 * 2. 更新导入路径
 * 3. 根据组件功能添加/删除测试部分（使用 analyze-component）
 * 4. 遵循 AAA 模式：Arrange → Act → Assert
 *
 * 首先运行：pnpm analyze-component <path> 以识别所需的测试场景
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import ComponentName from './index'

// ============================================================================
// Mocks
// ============================================================================
// 为什么：Mock 必须提升到文件顶部（Vitest 要求）。
// 它们在导入之前运行，所以将它们放在组件导入之前。

// i18n (自动 Mock)
// 为什么：web/vitest.setup.ts 中的全局 Mock 由 Vitest 设置自动加载
// 全局 Mock 提供：useTranslation, Trans, useMixedTranslation, useGetLanguage
// 大多数测试不需要显式 Mock
//
// 仅当需要自定义翻译时才覆盖：
// import { createReactI18nextMock } from '@/test/i18n-mock'
// vi.mock('react-i18next', () => createReactI18nextMock({
//   'my.custom.key': 'Custom Translation',
//   'button.save': 'Save',
// }))

// Router (如果组件使用 useRouter, usePathname, useSearchParams)
// 为什么：将测试与 Next.js 路由隔离，启用导航行为测试
// const mockPush = vi.fn()
// vi.mock('next/navigation', () => ({
//   useRouter: () => ({ push: mockPush }),
//   usePathname: () => '/test-path',
// }))

// API 服务 (如果组件获取数据)
// 为什么：防止真实网络调用，启用所有状态测试（加载/成功/错误）
// vi.mock('@/service/api')
// import * as api from '@/service/api'
// const mockedApi = vi.mocked(api)

// 共享 Mock 状态 (用于 portal/dropdown 组件)
// 为什么：像 PortalToFollowElem 这样的 Portal 组件需要在
// 父级和子级 Mock 之间共享状态，以正确模拟打开/关闭行为
// let mockOpenState = false

// ============================================================================
// 测试数据工厂
// ============================================================================
// 为什么要用工厂？
// - 避免硬编码的测试数据散落在测试中
// - 易于通过覆盖创建变体
// - 使用源中的实际类型时类型安全
// - 默认测试值的单一事实来源

// const createMockProps = (overrides = {}) => ({
//   // 使组件成功渲染的默认 props
//   ...overrides,
// })

// const createMockItem = (overrides = {}) => ({
//   id: 'item-1',
//   name: 'Test Item',
//   ...overrides,
// })

// ============================================================================
// 测试辅助函数
// ============================================================================

// const renderComponent = (props = {}) => {
//   return render(<ComponentName {...createMockProps(props)} />)
// }

// ============================================================================
// 测试
// ============================================================================

describe('ComponentName', () => {
  // 为什么要在 beforeEach 中使用 clearAllMocks？
  // - 确保每个测试都从干净的状态开始
  // - 防止 Mock 调用历史在测试之间泄漏
  // - 必须是 beforeEach（而不是 afterEach），以便在 toHaveBeenCalledTimes 等断言之前重置
  beforeEach(() => {
    vi.clearAllMocks()
    // 如果使用了共享 Mock 状态，请重置（对于 portal/dropdown 测试至关重要）
    // mockOpenState = false
  })

  // --------------------------------------------------------------------------
  // 渲染测试（必需 - 每个组件都必须有这些）
  // --------------------------------------------------------------------------
  // 为什么：捕获导入错误、缺少的提供者和基本渲染问题
  describe('Rendering', () => {
    it('should render without crashing', () => {
      // Arrange - 设置数据和 Mock
      // const props = createMockProps()

      // Act - 渲染组件
      // render(<ComponentName {...props} />)

      // Assert - 验证预期输出
      // 首选 getByRole 以实现无障碍性；这是用户“看到”的内容
      // expect(screen.getByRole('...')).toBeInTheDocument()
    })

    it('should render with default props', () => {
      // 为什么：验证组件在没有可选 props 的情况下工作
      // render(<ComponentName />)
      // expect(screen.getByText('...')).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // Props 测试（必需 - 每个组件都必须测试 prop 行为）
  // --------------------------------------------------------------------------
  // 为什么：Props 是组件的 API 契约。彻底测试它们。
  describe('Props', () => {
    it('should apply custom className', () => {
      // 为什么：Dify 中的常见模式 - 组件应合并自定义类
      // render(<ComponentName className="custom-class" />)
      // expect(screen.getByTestId('component')).toHaveClass('custom-class')
    })

    it('should use default values for optional props', () => {
      // 为什么：验证 TypeScript 默认值在运行时工作
      // render(<ComponentName />)
      // expect(screen.getByRole('...')).toHaveAttribute('...', 'default-value')
    })
  })

  // --------------------------------------------------------------------------
  // 用户交互（如果组件有事件处理程序 - on*, handle*）
  // --------------------------------------------------------------------------
  // 为什么：事件处理程序是核心功能。从用户的角度进行测试。
  describe('User Interactions', () => {
    it('should call onClick when clicked', async () => {
      // 为什么使用 userEvent 而不是 fireEvent？
      // - userEvent 模拟真实用户行为（聚焦、悬停，然后点击）
      // - fireEvent 更底层，不会触发所有浏览器事件
      // const user = userEvent.setup()
      // const handleClick = vi.fn()
      // render(<ComponentName onClick={handleClick} />)
      //
      // await user.click(screen.getByRole('button'))
      //
      // expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should call onChange when value changes', async () => {
      // const user = userEvent.setup()
      // const handleChange = vi.fn()
      // render(<ComponentName onChange={handleChange} />)
      //
      // await user.type(screen.getByRole('textbox'), 'new value')
      //
      // expect(handleChange).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // 状态管理（如果组件使用 useState/useReducer）
  // --------------------------------------------------------------------------
  // 为什么：通过可观察的 UI 更改测试状态，而不是内部状态值
  describe('State Management', () => {
    it('should update state on interaction', async () => {
      // 为什么通过 UI 而不是状态进行测试？
      // - 状态是实现细节；UI 是用户看到的
      // - 如果 UI 工作正常，状态一定是正确的
      // const user = userEvent.setup()
      // render(<ComponentName />)
      //
      // // Initial state - verify what user sees
      // // 初始状态 - 验证用户看到的
      // expect(screen.getByText('Initial')).toBeInTheDocument()
      //
      // // Trigger state change via user action
      // // 通过用户操作触发状态更改
      // await user.click(screen.getByRole('button'))
      //
      // // New state - verify UI updated
      // // 新状态 - 验证 UI 已更新
      // expect(screen.getByText('Updated')).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // 异步操作（如果组件获取数据 - useQuery, fetch）
  // --------------------------------------------------------------------------
  // 为什么：异步操作有用户体验到的 3 种状态：加载中、成功、错误
  describe('Async Operations', () => {
    it('should show loading state', () => {
      // 为什么使用永不解决的 promise？
      // - 保持组件处于加载状态以进行断言
      // - 替代方案：使用虚假计时器
      // mockedApi.fetchData.mockImplementation(() => new Promise(() => {}))
      // render(<ComponentName />)
      //
      // expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should show data on success', async () => {
      // 为什么使用 waitFor？
      // - 获取解决后组件异步更新
      // - waitFor 重试断言直到通过或超时
      // mockedApi.fetchData.mockResolvedValue({ items: ['Item 1'] })
      // render(<ComponentName />)
      //
      // await waitFor(() => {
      //   expect(screen.getByText('Item 1')).toBeInTheDocument()
      // })
    })

    it('should show error on failure', async () => {
      // mockedApi.fetchData.mockRejectedValue(new Error('Network error'))
      // render(<ComponentName />)
      //
      // await waitFor(() => {
      //   expect(screen.getByText(/error/i)).toBeInTheDocument()
      // })
    })
  })

  // --------------------------------------------------------------------------
  // 边界情况（必需 - 每个组件都必须处理边界情况）
  // --------------------------------------------------------------------------
  // 为什么：现实世界的数据是混乱的。组件必须处理：
  // - 来自 API 故障或可选字段的 Null/undefined
  // - 来自用户清除数据的空数组/字符串
  // - 边界值（0, MAX_INT, 特殊字符）
  describe('Edge Cases', () => {
    it('should handle null value', () => {
      // 为什么要专门测试 null？
      // - API 可能会针对丢失的数据返回 null
      // - 防止生产环境中的“Cannot read property of null”
      // render(<ComponentName value={null} />)
      // expect(screen.getByText(/no data/i)).toBeInTheDocument()
    })

    it('should handle undefined value', () => {
      // 为什么要将 undefined 与 null 分开测试？
      // - TypeScript 对它们的处理方式不同
      // - 可选 props 是 undefined，不是 null
      // render(<ComponentName value={undefined} />)
      // expect(screen.getByText(/no data/i)).toBeInTheDocument()
    })

    it('should handle empty array', () => {
      // 为什么：空状态通常需要特殊的 UI（例如，“No items yet”）
      // render(<ComponentName items={[]} />)
      // expect(screen.getByText(/empty/i)).toBeInTheDocument()
    })

    it('should handle empty string', () => {
      // 为什么：空字符串在 JS 中是真值，但在视觉上是空的
      // render(<ComponentName text="" />)
      // expect(screen.getByText(/placeholder/i)).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // 无障碍性（可选但推荐给 Dify 的企业用户）
  // --------------------------------------------------------------------------
  // 为什么：Dify 有可能需要符合无障碍性要求的企业客户
  describe('Accessibility', () => {
    it('should have accessible name', () => {
      // 为什么使用 getByRole 和 name？
      // - 测试屏幕阅读器是否可以识别元素
      // - 强制执行正确的标签实践
      // render(<ComponentName label="Test Label" />)
      // expect(screen.getByRole('button', { name: /test label/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      // 为什么：有些用户不能使用鼠标
      // const user = userEvent.setup()
      // render(<ComponentName />)
      //
      // await user.tab()
      // expect(screen.getByRole('button')).toHaveFocus()
    })
  })
})
