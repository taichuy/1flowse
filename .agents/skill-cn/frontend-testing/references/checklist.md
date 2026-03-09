# 测试生成检查清单

在为 Dify 前端组件生成或审查测试时使用此检查清单。

## 生成前

- [ ] 完整阅读组件源代码
- [ ] 识别组件类型（组件、Hook、工具函数、页面）
- [ ] 运行 `pnpm analyze-component <path>`（如果可用）
- [ ] 记录复杂度得分和检测到的功能
- [ ] 检查同一目录中现有的测试
- [ ] **识别目录中所有需要测试的文件**（不仅仅是 index）

## 测试策略

### ⚠️ 增量工作流（多文件关键）

- [ ] **切勿一次性生成所有测试** - 一次处理一个文件
- [ ] 按复杂度排序文件：工具函数 → Hook → 简单 → 复杂 → 集成
- [ ] 在开始之前创建一个待办事项列表来跟踪进度
- [ ] 对于每个文件：编写 → 运行测试 → 验证通过 → 然后下一个
- [ ] **不要继续** 到下一个文件，直到当前文件通过

### 路径级覆盖

- [ ] **测试分配的目录/路径中的所有文件**
- [ ] 列出所有需要覆盖的组件、Hook、工具函数
- [ ] 决定：单个规范文件（集成）还是多个规范文件（单元）

### 复杂度评估

- [ ] 运行 `pnpm analyze-component <path>` 获取复杂度得分
- [ ] **复杂度 > 50**：考虑在测试前重构
- [ ] **500+ 行**：考虑在测试前拆分
- [ ] **30-50 复杂度**：使用多个 describe 块，组织良好的结构

### 集成 vs Mock

- [ ] **不要 Mock 基础组件** (`Loading`, `Button`, `Tooltip` 等)
- [ ] 导入真实的项目组件而不是 Mock
- [ ] 仅 Mock：API 调用、复杂的上下文提供者、具有副作用的第三方库
- [ ] 当使用单个规范文件时，优先考虑集成测试

## 必需的测试部分

### 所有组件必须具有

- [ ] **渲染测试** - 组件渲染不崩溃
- [ ] **Props 测试** - 必需 props、可选 props、默认值
- [ ] **边界情况** - null、undefined、空值、边界

### 条件部分（当功能存在时添加）

| 功能 | 添加测试 |
|---------|---------------|
| `useState` | 初始状态、转换、清理 |
| `useEffect` | 执行、依赖项、清理 |
| 事件处理程序 | onClick、onChange、onSubmit、键盘 |
| API 调用 | 加载、成功、错误状态 |
| 路由 | 导航、参数、查询字符串 |
| `useCallback`/`useMemo` | 引用相等性 |
| Context | 提供者值、消费者行为 |
| 表单 | 验证、提交、错误显示 |

## 代码质量检查清单

### 结构

- [ ] 使用 `describe` 块对相关测试进行分组
- [ ] 测试名称遵循 `should <behavior> when <condition>` 模式
- [ ] AAA 模式 (Arrange-Act-Assert) 清晰
- [ ] 注释解释复杂的测试场景

### Mocks

- [ ] **不要 Mock 基础组件** (`@/app/components/base/*`)
- [ ] 在 `beforeEach` 中使用 `vi.clearAllMocks()`（而不是 `afterEach`）
- [ ] 在 `beforeEach` 中重置共享 Mock 状态
- [ ] i18n 使用全局 Mock（在 `web/vitest.setup.ts` 中自动加载）；仅在本地覆盖自定义翻译
- [ ] Router Mock 匹配实际的 Next.js API
- [ ] Mock 反映实际的组件条件行为
- [ ] 仅 Mock：API 服务、复杂的上下文提供者、第三方库
- [ ] 对于 `nuqs` URL 状态测试，使用 `NuqsTestingAdapter` 包装（首选 `web/test/nuqs-testing.tsx`）
- [ ] 对于 `nuqs` URL 状态测试，断言 `onUrlUpdate` 负载 (`searchParams`, `options.history`)
- [ ] 如果存在自定义 `nuqs` 解析器，为编码的边界情况（`%2F`、`%25`、空格、旧版编码值）添加往返测试

### 查询

- [ ] 优先使用语义查询 (`getByRole`, `getByLabelText`)
- [ ] 使用 `queryBy*` 进行不存在断言
- [ ] 使用 `findBy*` 获取异步元素
- [ ] 仅作为最后手段使用 `getByTestId`

### 异步

- [ ] 所有异步测试使用 `async/await`
- [ ] `waitFor` 包装异步断言
- [ ] 虚假计时器正确设置/拆卸
- [ ] 没有悬空的 Promise

### TypeScript

- [ ] 没有无理由的 `any` 类型
- [ ] Mock 数据使用源中的实际类型
- [ ] 工厂函数具有正确的返回类型

## 覆盖率目标（每个文件）

对于当前正在测试的文件：

- [ ] 100% 函数覆盖率
- [ ] 100% 语句覆盖率
- [ ] >95% 分支覆盖率
- [ ] >95% 行覆盖率

## 生成后（每个文件）

**在每个测试文件之后运行这些检查，而不仅仅是在最后：**

- [ ] 运行 `pnpm test path/to/file.spec.tsx` - **必须在下一个文件之前通过**
- [ ] 立即修复任何失败
- [ ] 在待办事项列表中将文件标记为完成
- [ ] 只有那时才继续处理下一个文件

### 所有文件完成后

- [ ] 运行完整的目录测试：`pnpm test path/to/directory/`
- [ ] 检查覆盖率报告：`pnpm test:coverage`
- [ ] 对所有测试文件运行 `pnpm lint:fix`
- [ ] 运行 `pnpm type-check:tsgo`

## 要注意的常见问题

### 误报 (False Positives)

```typescript
// ❌ Mock doesn't match actual behavior
// ❌ Mock 不匹配实际行为
vi.mock('./Component', () => () => <div>Mocked</div>)

// ✅ Mock matches actual conditional logic
// ✅ Mock 匹配实际条件逻辑
vi.mock('./Component', () => ({ isOpen }: any) =>
  isOpen ? <div>Content</div> : null
)
```

### 状态泄漏

```typescript
// ❌ Shared state not reset
// ❌ 共享状态未重置
let mockState = false
vi.mock('./useHook', () => () => mockState)

// ✅ Reset in beforeEach
// ✅ 在 beforeEach 中重置
beforeEach(() => {
  mockState = false
})
```

### 异步竞态条件

```typescript
// ❌ Not awaited
// ❌ 未 await
it('loads data', () => {
  render(<Component />)
  expect(screen.getByText('Data')).toBeInTheDocument()
})

// ✅ Properly awaited
// ✅ 正确 await
it('loads data', async () => {
  render(<Component />)
  await waitFor(() => {
    expect(screen.getByText('Data')).toBeInTheDocument()
  })
})
```

### 缺失边界情况

始终测试这些场景：

- `null` / `undefined` 输入
- 空字符串 / 数组 / 对象
- 边界值 (0, -1, MAX_INT)
- 错误状态
- 加载状态
- 禁用状态

## 快速命令

```bash
# Run specific test
# 运行特定测试
pnpm test path/to/file.spec.tsx

# Run with coverage
# 带覆盖率运行
pnpm test:coverage path/to/file.spec.tsx

# Watch mode
# 监视模式
pnpm test:watch path/to/file.spec.tsx

# Update snapshots (use sparingly)
# 更新快照（谨慎使用）
pnpm test -u path/to/file.spec.tsx

# Analyze component
# 分析组件
pnpm analyze-component path/to/component.tsx

# Review existing test
# 审查现有测试
pnpm analyze-component path/to/component.tsx --review
```
