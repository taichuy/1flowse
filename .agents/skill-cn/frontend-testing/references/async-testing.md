# 异步测试指南

## 核心异步模式

### 1. waitFor - 等待条件

```typescript
import { render, screen, waitFor } from '@testing-library/react'

it('should load and display data', async () => {
  render(<DataComponent />)
  
  // Wait for element to appear
  // 等待元素出现
  await waitFor(() => {
    expect(screen.getByText('Loaded Data')).toBeInTheDocument()
  })
})

it('should hide loading spinner after load', async () => {
  render(<DataComponent />)
  
  // Wait for element to disappear
  // 等待元素消失
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})
```

### 2. findBy\* - 异步查询

```typescript
it('should show user name after fetch', async () => {
  render(<UserProfile />)
  
  // findBy returns a promise, auto-waits up to 1000ms
  // findBy 返回一个 promise，自动等待最多 1000ms
  const userName = await screen.findByText('John Doe')
  expect(userName).toBeInTheDocument()
  
  // findByRole with options
  // 带有选项的 findByRole
  const button = await screen.findByRole('button', { name: /submit/i })
  expect(button).toBeEnabled()
})
```

### 3. 用于异步交互的 userEvent

```typescript
import userEvent from '@testing-library/user-event'

it('should submit form', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  
  render(<Form onSubmit={onSubmit} />)
  
  // userEvent methods are async
  // userEvent 方法是异步的
  await user.type(screen.getByLabelText('Email'), 'test@example.com')
  await user.click(screen.getByRole('button', { name: /submit/i }))
  
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com' })
  })
})
```

## 虚假计时器 (Fake Timers)

### 何时使用虚假计时器

- 测试带有 `setTimeout`/`setInterval` 的组件
- 测试防抖/节流行为
- 测试动画或延迟过渡
- 测试轮询或重试逻辑

### 基本虚假计时器设置

```typescript
describe('Debounced Search', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should debounce search input', async () => {
    const onSearch = vi.fn()
    render(<SearchInput onSearch={onSearch} debounceMs={300} />)
    
    // Type in the input
    // 在输入框中输入
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'query' } })
    
    // Search not called immediately
    // 搜索不会立即调用
    expect(onSearch).not.toHaveBeenCalled()
    
    // Advance timers
    // 推进计时器
    vi.advanceTimersByTime(300)
    
    // Now search is called
    // 现在搜索被调用
    expect(onSearch).toHaveBeenCalledWith('query')
  })
})
```

### 带有异步代码的虚假计时器

```typescript
it('should retry on failure', async () => {
  vi.useFakeTimers()
  const fetchData = vi.fn()
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({ data: 'success' })
  
  render(<RetryComponent fetchData={fetchData} retryDelayMs={1000} />)
  
  // First call fails
  // 第一次调用失败
  await waitFor(() => {
    expect(fetchData).toHaveBeenCalledTimes(1)
  })
  
  // Advance timer for retry
  // 推进计时器以重试
  vi.advanceTimersByTime(1000)
  
  // Second call succeeds
  // 第二次调用成功
  await waitFor(() => {
    expect(fetchData).toHaveBeenCalledTimes(2)
    expect(screen.getByText('success')).toBeInTheDocument()
  })
  
  vi.useRealTimers()
})
```

### 常见虚假计时器工具

```typescript
// Run all pending timers
// 运行所有挂起的计时器
vi.runAllTimers()

// Run only pending timers (not new ones created during execution)
// 仅运行挂起的计时器（不运行执行期间创建的新计时器）
vi.runOnlyPendingTimers()

// Advance by specific time
// 推进特定时间
vi.advanceTimersByTime(1000)

// Get current fake time
// 获取当前虚假时间
Date.now()

// Clear all timers
// 清除所有计时器
vi.clearAllTimers()
```

## API 测试模式

### 加载中 → 成功 → 错误状态

```typescript
describe('DataFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state', () => {
    mockedApi.fetchData.mockImplementation(() => new Promise(() => {})) // Never resolves (永远不解决)
    
    render(<DataFetcher />)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('should show data on success', async () => {
    mockedApi.fetchData.mockResolvedValue({ items: ['Item 1', 'Item 2'] })
    
    render(<DataFetcher />)
    
    // Use findBy* for multiple async elements (better error messages than waitFor with multiple assertions)
    // 对多个异步元素使用 findBy*（比带有多个断言的 waitFor 更好的错误消息）
    const item1 = await screen.findByText('Item 1')
    const item2 = await screen.findByText('Item 2')
    expect(item1).toBeInTheDocument()
    expect(item2).toBeInTheDocument()
    
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
  })

  it('should show error on failure', async () => {
    mockedApi.fetchData.mockRejectedValue(new Error('Failed to fetch'))
    
    render(<DataFetcher />)
    
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument()
    })
  })

  it('should retry on error', async () => {
    mockedApi.fetchData.mockRejectedValue(new Error('Network error'))
    
    render(<DataFetcher />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
    
    mockedApi.fetchData.mockResolvedValue({ items: ['Item 1'] })
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
  })
})
```

### 测试变更 (Mutations)

```typescript
it('should submit form and show success', async () => {
  const user = userEvent.setup()
  mockedApi.createItem.mockResolvedValue({ id: '1', name: 'New Item' })
  
  render(<CreateItemForm />)
  
  await user.type(screen.getByLabelText('Name'), 'New Item')
  await user.click(screen.getByRole('button', { name: /create/i }))
  
  // Button should be disabled during submission
  // 提交期间按钮应被禁用
  expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
  
  await waitFor(() => {
    expect(screen.getByText(/created successfully/i)).toBeInTheDocument()
  })
  
  expect(mockedApi.createItem).toHaveBeenCalledWith({ name: 'New Item' })
})
```

## useEffect 测试

### 测试 Effect 执行

```typescript
it('should fetch data on mount', async () => {
  const fetchData = vi.fn().mockResolvedValue({ data: 'test' })
  
  render(<ComponentWithEffect fetchData={fetchData} />)
  
  await waitFor(() => {
    expect(fetchData).toHaveBeenCalledTimes(1)
  })
})
```

### 测试 Effect 依赖

```typescript
it('should refetch when id changes', async () => {
  const fetchData = vi.fn().mockResolvedValue({ data: 'test' })
  
  const { rerender } = render(<ComponentWithEffect id="1" fetchData={fetchData} />)
  
  await waitFor(() => {
    expect(fetchData).toHaveBeenCalledWith('1')
  })
  
  rerender(<ComponentWithEffect id="2" fetchData={fetchData} />)
  
  await waitFor(() => {
    expect(fetchData).toHaveBeenCalledWith('2')
    expect(fetchData).toHaveBeenCalledTimes(2)
  })
})
```

### 测试 Effect 清理

```typescript
it('should cleanup subscription on unmount', () => {
  const subscribe = vi.fn()
  const unsubscribe = vi.fn()
  subscribe.mockReturnValue(unsubscribe)
  
  const { unmount } = render(<SubscriptionComponent subscribe={subscribe} />)
  
  expect(subscribe).toHaveBeenCalledTimes(1)
  
  unmount()
  
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})
```

## 常见异步陷阱

### ❌ Don't: 忘记 await

```typescript
// Bad - test may pass even if assertion fails
// 错误 - 即使断言失败，测试也可能通过
it('should load data', () => {
  render(<Component />)
  waitFor(() => {
    expect(screen.getByText('Data')).toBeInTheDocument()
  })
})

// Good - properly awaited
// 正确 - 正确 await
it('should load data', async () => {
  render(<Component />)
  await waitFor(() => {
    expect(screen.getByText('Data')).toBeInTheDocument()
  })
})
```

### ❌ Don't: 在单个 waitFor 中使用多个断言

```typescript
// Bad - if first assertion fails, won't know about second
// 错误 - 如果第一个断言失败，将不知道第二个断言的情况
await waitFor(() => {
  expect(screen.getByText('Title')).toBeInTheDocument()
  expect(screen.getByText('Description')).toBeInTheDocument()
})

// Good - separate waitFor or use findBy
// 正确 - 分开 waitFor 或使用 findBy
const title = await screen.findByText('Title')
const description = await screen.findByText('Description')
expect(title).toBeInTheDocument()
expect(description).toBeInTheDocument()
```

### ❌ Don't: 混合使用虚假计时器和真实异步

```typescript
// Bad - fake timers don't work well with real Promises
// 错误 - 虚假计时器与真实 Promise 配合不好
vi.useFakeTimers()
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument()
}) // May timeout! (可能会超时！)

// Good - use runAllTimers or advanceTimersByTime
// 正确 - 使用 runAllTimers 或 advanceTimersByTime
vi.useFakeTimers()
render(<Component />)
vi.runAllTimers()
expect(screen.getByText('Data')).toBeInTheDocument()
```
