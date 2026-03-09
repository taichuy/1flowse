# 通用测试模式

## 查询优先级

按此顺序使用查询（从最推荐到最不推荐）：

```typescript
// 1. getByRole - Most recommended (accessibility)
// 1. getByRole - 最推荐（无障碍）
screen.getByRole('button', { name: /submit/i })
screen.getByRole('textbox', { name: /email/i })
screen.getByRole('heading', { level: 1 })

// 2. getByLabelText - Form fields
// 2. getByLabelText - 表单字段
screen.getByLabelText('Email address')
screen.getByLabelText(/password/i)

// 3. getByPlaceholderText - When no label
// 3. getByPlaceholderText - 无标签时
screen.getByPlaceholderText('Search...')

// 4. getByText - Non-interactive elements
// 4. getByText - 非交互元素
screen.getByText('Welcome to Dify')
screen.getByText(/loading/i)

// 5. getByDisplayValue - Current input value
// 5. getByDisplayValue - 当前输入值
screen.getByDisplayValue('current value')

// 6. getByAltText - Images
// 6. getByAltText - 图片
screen.getByAltText('Company logo')

// 7. getByTitle - Tooltip elements
// 7. getByTitle - 工具提示元素
screen.getByTitle('Close')

// 8. getByTestId - Last resort only!
// 8. getByTestId - 仅作为最后手段！
screen.getByTestId('custom-element')
```

## 事件处理模式

### 点击事件

```typescript
// Basic click
// 基本点击
fireEvent.click(screen.getByRole('button'))

// With userEvent (preferred for realistic interaction)
// 使用 userEvent（推荐用于真实交互）
const user = userEvent.setup()
await user.click(screen.getByRole('button'))

// Double click
// 双击
await user.dblClick(screen.getByRole('button'))

// Right click
// 右键点击
await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button') })
```

### 表单输入

```typescript
const user = userEvent.setup()

// Type in input
// 在输入框中输入
await user.type(screen.getByRole('textbox'), 'Hello World')

// Clear and type
// 清除并输入
await user.clear(screen.getByRole('textbox'))
await user.type(screen.getByRole('textbox'), 'New value')

// Select option
// 选择选项
await user.selectOptions(screen.getByRole('combobox'), 'option-value')

// Check checkbox
// 勾选复选框
await user.click(screen.getByRole('checkbox'))

// Upload file
// 上传文件
const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
await user.upload(screen.getByLabelText(/upload/i), file)
```

### 键盘事件

```typescript
const user = userEvent.setup()

// Press Enter
// 按下 Enter
await user.keyboard('{Enter}')

// Press Escape
// 按下 Escape
await user.keyboard('{Escape}')

// Keyboard shortcut
// 键盘快捷键
await user.keyboard('{Control>}a{/Control}') // Ctrl+A

// Tab navigation
// Tab 导航
await user.tab()

// Arrow keys
// 方向键
await user.keyboard('{ArrowDown}')
await user.keyboard('{ArrowUp}')
```

## 组件状态测试

### 测试状态转换

```typescript
describe('Counter', () => {
  it('should increment count', async () => {
    const user = userEvent.setup()
    render(<Counter initialCount={0} />)
    
    // Initial state
    // 初始状态
    expect(screen.getByText('Count: 0')).toBeInTheDocument()
    
    // Trigger transition
    // 触发转换
    await user.click(screen.getByRole('button', { name: /increment/i }))
    
    // New state
    // 新状态
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })
})
```

### 测试受控组件

```typescript
describe('ControlledInput', () => {
  it('should call onChange with new value', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    
    render(<ControlledInput value="" onChange={handleChange} />)
    
    await user.type(screen.getByRole('textbox'), 'a')
    
    expect(handleChange).toHaveBeenCalledWith('a')
  })

  it('should display controlled value', () => {
    render(<ControlledInput value="controlled" onChange={vi.fn()} />)
    
    expect(screen.getByRole('textbox')).toHaveValue('controlled')
  })
})
```

## 条件渲染测试

```typescript
describe('ConditionalComponent', () => {
  it('should show loading state', () => {
    render(<DataDisplay isLoading={true} data={null} />)
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(screen.queryByTestId('data-content')).not.toBeInTheDocument()
  })

  it('should show error state', () => {
    render(<DataDisplay isLoading={false} data={null} error="Failed to load" />)
    
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  })

  it('should show data when loaded', () => {
    render(<DataDisplay isLoading={false} data={{ name: 'Test' }} />)
    
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('should show empty state when no data', () => {
    render(<DataDisplay isLoading={false} data={[]} />)
    
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })
})
```

## 列表渲染测试

```typescript
describe('ItemList', () => {
  const items = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
  ]

  it('should render all items', () => {
    render(<ItemList items={items} />)
    
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    items.forEach(item => {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    })
  })

  it('should handle item selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    
    render(<ItemList items={items} onSelect={onSelect} />)
    
    await user.click(screen.getByText('Item 2'))
    
    expect(onSelect).toHaveBeenCalledWith(items[1])
  })

  it('should handle empty list', () => {
    render(<ItemList items={[]} />)
    
    expect(screen.getByText(/no items/i)).toBeInTheDocument()
  })
})
```

## 模态框/对话框测试

```typescript
describe('Modal', () => {
  it('should not render when closed', () => {
    render(<Modal isOpen={false} onClose={vi.fn()} />)
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} />)
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('should call onClose when clicking overlay', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    
    render(<Modal isOpen={true} onClose={handleClose} />)
    
    await user.click(screen.getByTestId('modal-overlay'))
    
    expect(handleClose).toHaveBeenCalled()
  })

  it('should call onClose when pressing Escape', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    
    render(<Modal isOpen={true} onClose={handleClose} />)
    
    await user.keyboard('{Escape}')
    
    expect(handleClose).toHaveBeenCalled()
  })

  it('should trap focus inside modal', async () => {
    const user = userEvent.setup()
    
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <button>First</button>
        <button>Second</button>
      </Modal>
    )
    
    // Focus should cycle within modal
    // 焦点应在模态框内循环
    await user.tab()
    expect(screen.getByText('First')).toHaveFocus()
    
    await user.tab()
    expect(screen.getByText('Second')).toHaveFocus()
    
    await user.tab()
    expect(screen.getByText('First')).toHaveFocus() // Cycles back
  })
})
```

## 表单测试

```typescript
describe('LoginForm', () => {
  it('should submit valid form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    
    render(<LoginForm onSubmit={onSubmit} />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('should show validation errors', async () => {
    const user = userEvent.setup()
    
    render(<LoginForm onSubmit={vi.fn()} />)
    
    // Submit empty form
    // 提交空表单
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
  })

  it('should validate email format', async () => {
    const user = userEvent.setup()
    
    render(<LoginForm onSubmit={vi.fn()} />)
    
    await user.type(screen.getByLabelText(/email/i), 'invalid-email')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
  })

  it('should disable submit button while submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<LoginForm onSubmit={onSubmit} />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled()
    })
  })
})
```

## 使用 test.each 进行数据驱动测试

```typescript
describe('StatusBadge', () => {
  test.each([
    ['success', 'bg-green-500'],
    ['warning', 'bg-yellow-500'],
    ['error', 'bg-red-500'],
    ['info', 'bg-blue-500'],
  ])('should apply correct class for %s status', (status, expectedClass) => {
    render(<StatusBadge status={status} />)
    
    expect(screen.getByTestId('status-badge')).toHaveClass(expectedClass)
  })

  test.each([
    { input: null, expected: 'Unknown' },
    { input: undefined, expected: 'Unknown' },
    { input: '', expected: 'Unknown' },
    { input: 'invalid', expected: 'Unknown' },
  ])('should show "Unknown" for invalid input: $input', ({ input, expected }) => {
    render(<StatusBadge status={input} />)
    
    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
```

## 调试技巧

```typescript
// Print entire DOM
// 打印整个 DOM
screen.debug()

// Print specific element
// 打印特定元素
screen.debug(screen.getByRole('button'))

// Log testing playground URL
// 记录测试游乐场 URL
screen.logTestingPlaygroundURL()

// Pretty print DOM
// 美化打印 DOM
import { prettyDOM } from '@testing-library/react'
console.log(prettyDOM(screen.getByRole('dialog')))

// Check available roles
// 检查可用角色
import { getRoles } from '@testing-library/react'
console.log(getRoles(container))
```

## 要避免的常见错误

### ❌ Don't: 使用实现细节

```typescript
// Bad - testing implementation
// 错误 - 测试实现
expect(component.state.isOpen).toBe(true)
expect(wrapper.find('.internal-class').length).toBe(1)

// Good - testing behavior
// 正确 - 测试行为
expect(screen.getByRole('dialog')).toBeInTheDocument()
```

### ❌ Don't: 忘记清理

```typescript
// Bad - may leak state between tests
// 错误 - 可能在测试之间泄漏状态
it('test 1', () => {
  render(<Component />)
})

// Good - cleanup is automatic with RTL, but reset mocks
// 正确 - RTL 自动清理，但重置 Mock
beforeEach(() => {
  vi.clearAllMocks()
})
```

### ❌ Don't: 使用精确字符串匹配（首选黑盒断言）

```typescript
// ❌ Bad - hardcoded strings are brittle
// ❌ 错误 - 硬编码字符串很脆弱
expect(screen.getByText('Submit Form')).toBeInTheDocument()
expect(screen.getByText('Loading...')).toBeInTheDocument()

// ✅ Good - role-based queries (most semantic)
// ✅ 正确 - 基于角色的查询（最语义化）
expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
expect(screen.getByRole('status')).toBeInTheDocument()

// ✅ Good - pattern matching (flexible)
// ✅ 正确 - 模式匹配（灵活）
expect(screen.getByText(/submit/i)).toBeInTheDocument()
expect(screen.getByText(/loading/i)).toBeInTheDocument()

// ✅ Good - test behavior, not exact UI text
// ✅ 正确 - 测试行为，而不是精确的 UI 文本
expect(screen.getByRole('button')).toBeDisabled()
expect(screen.getByRole('alert')).toBeInTheDocument()
```

**为什么首选黑盒断言？**

- 文本内容可能会更改（i18n、文案更新）
- 基于角色的查询测试无障碍性
- 模式匹配对微小更改具有弹性
- 测试关注行为，而不是实现细节

### ❌ Don't: 在没有查询的情况下断言不存在

```typescript
// Bad - throws if not found
// 错误 - 如果未找到则抛出
expect(screen.getByText('Error')).not.toBeInTheDocument() // Error!

// Good - use queryBy for absence assertions
// 正确 - 使用 queryBy 进行不存在断言
expect(screen.queryByText('Error')).not.toBeInTheDocument()
```
