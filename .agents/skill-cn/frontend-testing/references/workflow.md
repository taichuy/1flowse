# 测试工作流指南

本指南定义了生成测试的工作流，特别是针对复杂组件或具有多个文件的目录。

## 范围澄清

本指南解决 **多文件工作流**（如何处理多个测试文件）。有关单个测试文件中的覆盖率要求，请参阅 `web/docs/test.md` § 覆盖率目标。

| 范围 | 规则 |
|-------|------|
| **单文件** | 一次生成完成覆盖（100% 函数，>95% 分支） |
| **多文件目录** | 一次处理一个文件，在继续之前验证每个文件 |

## ⚠️ 关键规则：多文件测试的增量方法

当测试 **具有多个文件的目录** 时，**切勿一次性生成所有测试文件。** 使用增量的、边做边验证的方法。

### 为什么增量？

| 批处理方法 (❌) | 增量方法 (✅) |
|---------------------|---------------------------|
| 一次生成 5+ 个测试 | 一次生成 1 个测试 |
| 仅在最后运行测试 | 每个文件后立即运行测试 |
| 多个失败复合 | 单点故障，易于调试 |
| 难以识别根本原因 | 清晰的因果关系 |
| Mock 问题影响许多文件 | 早期捕获 Mock 问题 |
| 混乱的 git 历史 | 可能有干净、原子的提交 |

## 单文件工作流

当测试 **单个组件、Hook 或工具函数** 时：

```
1. 完整阅读源代码
2. 运行 `pnpm analyze-component <path>`（如果可用）
3. 检查复杂度得分和检测到的功能
4. 编写测试文件
5. 运行测试：`pnpm test <file>.spec.tsx`
6. 修复任何失败
7. 验证覆盖率符合目标（100% 函数，>95% 分支）
```

## 目录/多文件工作流（必须遵循）

当测试 **目录或多个文件** 时，遵循此严格的工作流：

### 步骤 1：分析和计划

1. **列出目录中需要测试的所有文件**
1. **按复杂度分类**：
   - 🟢 **简单**：工具函数、简单 Hook、展示性组件
   - 🟡 **中等**：具有状态、副作用或事件处理程序的组件
   - 🔴 **复杂**：具有 API 调用、路由或许多依赖项的组件
1. **按依赖关系排序**：在依赖者之前测试依赖项
1. **创建待办事项列表** 以跟踪进度

### 步骤 2：确定处理顺序

按此推荐顺序处理文件：

```
1. 工具函数（最简单，无 React）
2. 自定义 Hook（隔离逻辑）
3. 简单展示性组件（很少/没有 props）
4. 中等复杂度组件（状态、副作用）
5. 复杂组件（API、路由、许多依赖项）
6. 容器/索引组件（集成测试 - 最后）
```

**理由**：

- 更简单的文件有助于建立 Mock 模式
- 组件使用的 Hook 应首先测试
- 集成测试（索引文件）依赖于子组件工作

### 步骤 3：增量处理每个文件

**对于有序列表中的每个文件：**

```
┌─────────────────────────────────────────────┐
│  1. Write test file                         │
│  1. 编写测试文件                            │
│  2. Run: pnpm test <file>.spec.tsx          │
│  2. 运行: pnpm test <file>.spec.tsx         │
│  3. If FAIL → Fix immediately, re-run       │
│  3. 如果失败 → 立即修复，重新运行           │
│  4. If PASS → Mark complete in todo list    │
│  4. 如果通过 → 在待办事项列表中标记完成     │
│  5. ONLY THEN proceed to next file          │
│  5. 只有那时才继续处理下一个文件            │
└─────────────────────────────────────────────┘
```

**在当前文件通过之前，不要继续处理下一个文件。**

### 步骤 4：最终验证

在所有单独测试通过后：

```bash
# 一起运行目录中的所有测试
pnpm test path/to/directory/

# 检查覆盖率
pnpm test:coverage path/to/directory/
```

## 组件复杂度指南

在测试之前使用 `pnpm analyze-component <path>` 评估复杂度。

### 🔴 非常复杂的组件（复杂度 > 50）

**考虑在测试之前重构：**

- 将组件拆分为更小、可测试的部分
- 将复杂逻辑提取到自定义 Hook 中
- 分离容器和展示层

**如果按原样测试：**

- 对复杂工作流使用集成测试
- 使用 `test.each()` 进行数据驱动测试
- 多个 `describe` 块进行组织
- 考虑分别测试主要部分

### 🟡 中等复杂度（复杂度 30-50）

- 在 `describe` 块中分组相关测试
- 测试内部部分之间的集成场景
- 关注状态转换和副作用
- 使用辅助函数减少测试复杂度

### 🟢 简单组件（复杂度 < 30）

- 标准测试结构
- 关注 props、渲染和边界情况
- 通常可以直接测试

### 📏 大型文件（500+ 行）

无论复杂度得分如何：

- **强烈考虑在测试之前重构**
- 如果按原样测试，分别测试主要部分
- 为测试设置创建辅助函数
- 可能需要多个测试文件

## 待办事项列表格式

当测试多个文件时，使用这样的待办事项列表：

```
Testing: path/to/directory/

Ordered by complexity (simple → complex):

☐ utils/helper.ts           [utility, simple]
☐ hooks/use-custom-hook.ts  [hook, simple]
☐ empty-state.tsx           [component, simple]
☐ item-card.tsx             [component, medium]
☐ list.tsx                  [component, complex]
☐ index.tsx                 [integration]

Progress: 0/6 complete
```

当你完成每个时更新状态：

- ☐ → ⏳ (进行中)
- ⏳ → ✅ (完成并验证)
- ⏳ → ❌ (受阻，需要关注)

## 何时停止和验证

**始终在以下情况后运行测试：**

- 完成一个测试文件
- 更改以修复失败
- 修改共享 Mock
- 更新测试工具或辅助函数

**你应该暂停的迹象：**

- 超过 2 个连续的测试失败
- 出现 Mock 相关错误
- 不清楚为什么测试失败
- 测试通过但覆盖率意外低

## 要避免的常见陷阱

### ❌ Don't: 首先生成所有内容

```
# BAD: Writing all files then testing
# 错误：编写所有文件然后测试
Write component-a.spec.tsx
Write component-b.spec.tsx  
Write component-c.spec.tsx
Write component-d.spec.tsx
Run pnpm test  ← Multiple failures, hard to debug (多个失败，难以调试)
```

### ✅ Do: 验证每一步

```
# GOOD: Incremental with verification
# 正确：增量验证
Write component-a.spec.tsx
Run pnpm test component-a.spec.tsx ✅
Write component-b.spec.tsx
Run pnpm test component-b.spec.tsx ✅
...continue...
```

### ❌ Don't: 跳过“简单”组件的验证

即使是简单的组件也可能有：

- 导入错误
- 缺少 Mock 设置
- 关于 props 的错误假设

**无论感知到的简单性如何，始终验证。**

### ❌ Don't: 当测试失败时继续

失败的测试会复合：

- 文件 A 中的 Mock 问题影响文件 B、C、D
- 稍后修复 A 需要重新访问所有依赖测试
- 浪费时间调试级联失败

**在继续之前立即修复失败。**

## 与 Claude 的 Todo 功能集成

当使用 Claude 进行多文件测试时：

1. **要求 Claude 创建待办事项列表** 在开始之前
1. **一次请求一个文件** 或确保 Claude 增量处理
1. **验证每个测试通过** 在要求下一个之前
1. **标记待办事项完成** 随着你的进展

示例提示：

```
Test all components in `path/to/directory/`.
First, analyze the directory and create a todo list ordered by complexity.
Then, process ONE file at a time, waiting for my confirmation that tests pass
before proceeding to the next.
```

## 总结检查清单

在开始多文件测试之前：

- [ ] 列出所有需要测试的文件
- [ ] 按复杂度排序（简单 → 复杂）
- [ ] 创建待办事项列表以跟踪
- [ ] 了解文件之间的依赖关系

测试期间：

- [ ] 一次处理一个文件
- [ ] 每个文件后运行测试
- [ ] 在继续之前修复失败
- [ ] 更新待办事项列表进度

完成后：

- [ ] 所有单独测试通过
- [ ] 完整目录测试运行通过
- [ ] 满足覆盖率目标
- [ ] 待办事项列表显示全部完成
