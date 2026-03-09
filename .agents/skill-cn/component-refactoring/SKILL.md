---
name: component-refactoring
description: 重构 Dify 前端的高复杂度 React 组件。当 `pnpm analyze-component --json` 显示复杂度 > 50 或 lineCount > 300 时，当用户要求代码拆分、Hook 提取或降低复杂度时，或者当 `pnpm analyze-component` 警告在测试前进行重构时使用；避免用于简单/结构良好的组件、第三方包装器，或者当用户明确想要测试而不重构时。
---

# Dify 组件重构技能

使用以下模式和工作流程重构 Dify 前端代码库中的高复杂度 React 组件。

> **复杂度阈值**：复杂度 > 50（由 `pnpm analyze-component` 测量）的组件应在测试前进行重构。

## 快速参考

### 命令 (在 `web/` 目录下运行)

使用相对于 `web/` 的路径（例如，`app/components/...`）。
使用 `refactor-component` 获取重构提示，使用 `analyze-component` 获取测试提示和指标。

```bash
cd web

# 生成重构提示
pnpm refactor-component <path>

# 输出重构分析为 JSON
pnpm refactor-component <path> --json

# 生成测试提示 (重构后)
pnpm analyze-component <path>

# 输出测试分析为 JSON
pnpm analyze-component <path> --json
```

### 复杂度分析

```bash
# 分析组件复杂度
pnpm analyze-component <path> --json

# 检查的关键指标：
# - complexity: 归一化得分 0-100 (目标 < 50)
# - maxComplexity: 单个函数的最高复杂度
# - lineCount: 总行数 (目标 < 300)
```

### 复杂度得分说明

| 得分 | 级别 | 行动 |
|-------|-------|--------|
| 0-25 | 🟢 简单 | 准备测试 |
| 26-50 | 🟡 中等 | 考虑小幅重构 |
| 51-75 | 🟠 复杂 | **测试前重构** |
| 76-100 | 🔴 非常复杂 | **必须重构** |

## 核心重构模式

### 模式 1：提取自定义 Hook

**何时使用**：组件具有复杂的状态管理、多个 `useState`/`useEffect`，或业务逻辑与 UI 混合。

**Dify 约定**：将 Hook 放置在 `hooks/` 子目录中，或作为 `use-<feature>.ts` 与组件并以此放置。

```typescript
// ❌ Before: 组件中的复杂状态逻辑
const Configuration: FC = () => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(...)
  const [datasetConfigs, setDatasetConfigs] = useState<DatasetConfigs>(...)
  const [completionParams, setCompletionParams] = useState<FormValue>({})
  
  // 50+ lines of state management logic...
  // 50 多行状态管理逻辑...
  
  return <div>...</div>
}

// ✅ After: 提取到自定义 Hook
// hooks/use-model-config.ts
export const useModelConfig = (appId: string) => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(...)
  const [completionParams, setCompletionParams] = useState<FormValue>({})
  
  // Related state management logic here
  // 相关的状态管理逻辑在这里
  
  return { modelConfig, setModelConfig, completionParams, setCompletionParams }
}

// Component becomes cleaner
// 组件变得更整洁
const Configuration: FC = () => {
  const { modelConfig, setModelConfig } = useModelConfig(appId)
  return <div>...</div>
}
```

**Dify 示例**：
- `web/app/components/app/configuration/hooks/use-advanced-prompt-config.ts`
- `web/app/components/app/configuration/debug/hooks.tsx`
- `web/app/components/workflow/hooks/use-workflow.ts`

### 模式 2：提取子组件

**何时使用**：单个组件具有多个 UI 部分、条件渲染块或重复模式。

**Dify 约定**：将子组件放置在子目录中，或作为单独的文件放置在同一目录中。

```typescript
// ❌ Before: 具有多个部分的单体 JSX
const AppInfo = () => {
  return (
    <div>
      {/* 100 lines of header UI */}
      {/* 100 行标题 UI */}
      {/* 100 lines of operations UI */}
      {/* 100 行操作 UI */}
      {/* 100 lines of modals */}
      {/* 100 行模态框 */}
    </div>
  )
}

// ✅ After: 拆分为专注的组件
// app-info/
//   ├── index.tsx           (仅编排)
//   ├── app-header.tsx      (标题 UI)
//   ├── app-operations.tsx  (操作 UI)
//   └── app-modals.tsx      (模态框管理)

const AppInfo = () => {
  const { showModal, setShowModal } = useAppInfoModals()
  
  return (
    <div>
      <AppHeader appDetail={appDetail} />
      <AppOperations onAction={handleAction} />
      <AppModals show={showModal} onClose={() => setShowModal(null)} />
    </div>
  )
}
```

**Dify 示例**：
- `web/app/components/app/configuration/` 目录结构
- `web/app/components/workflow/nodes/` 每个节点的组织

### 模式 3：简化条件逻辑

**何时使用**：深度嵌套（> 3 层）、复杂的三元运算符或多个 `if/else` 链。

```typescript
// ❌ Before: 深度嵌套的条件
const Template = useMemo(() => {
  if (appDetail?.mode === AppModeEnum.CHAT) {
    switch (locale) {
      case LanguagesSupported[1]:
        return <TemplateChatZh />
      case LanguagesSupported[7]:
        return <TemplateChatJa />
      default:
        return <TemplateChatEn />
    }
  }
  if (appDetail?.mode === AppModeEnum.ADVANCED_CHAT) {
    // Another 15 lines...
    // 另外 15 行...
  }
  // More conditions...
  // 更多条件...
}, [appDetail, locale])

// ✅ After: 使用查找表 + 提前返回
const TEMPLATE_MAP = {
  [AppModeEnum.CHAT]: {
    [LanguagesSupported[1]]: TemplateChatZh,
    [LanguagesSupported[7]]: TemplateChatJa,
    default: TemplateChatEn,
  },
  [AppModeEnum.ADVANCED_CHAT]: {
    [LanguagesSupported[1]]: TemplateAdvancedChatZh,
    // ...
  },
}

const Template = useMemo(() => {
  const modeTemplates = TEMPLATE_MAP[appDetail?.mode]
  if (!modeTemplates) return null
  
  const TemplateComponent = modeTemplates[locale] || modeTemplates.default
  return <TemplateComponent appDetail={appDetail} />
}, [appDetail, locale])
```

### 模式 4：提取 API/数据逻辑

**何时使用**：组件直接处理 API 调用、数据转换或复杂的异步操作。

**Dify 约定**：使用 `web/service/use-*.ts` 中的 `@tanstack/react-query` Hook 或创建自定义数据 Hook。

```typescript
// ❌ Before: 组件中的 API 逻辑
const MCPServiceCard = () => {
  const [basicAppConfig, setBasicAppConfig] = useState({})
  
  useEffect(() => {
    if (isBasicApp && appId) {
      (async () => {
        const res = await fetchAppDetail({ url: '/apps', id: appId })
        setBasicAppConfig(res?.model_config || {})
      })()
    }
  }, [appId, isBasicApp])
  
  // More API-related logic...
  // 更多 API 相关逻辑...
}

// ✅ After: 使用 React Query 提取到数据 Hook
// use-app-config.ts
import { useQuery } from '@tanstack/react-query'
import { get } from '@/service/base'

const NAME_SPACE = 'appConfig'

export const useAppConfig = (appId: string, isBasicApp: boolean) => {
  return useQuery({
    enabled: isBasicApp && !!appId,
    queryKey: [NAME_SPACE, 'detail', appId],
    queryFn: () => get<AppDetailResponse>(`/apps/${appId}`),
    select: data => data?.model_config || {},
  })
}

// Component becomes cleaner
// 组件变得更整洁
const MCPServiceCard = () => {
  const { data: config, isLoading } = useAppConfig(appId, isBasicApp)
  // UI only
  // 仅 UI
}
```

**Dify 中的 React Query 最佳实践**：
- 定义 `NAME_SPACE` 用于查询键组织
- 使用 `enabled` 选项进行条件获取
- 使用 `select` 进行数据转换
- 导出失效 Hook：`useInvalidXxx`

**Dify 示例**：
- `web/service/use-workflow.ts`
- `web/service/use-common.ts`
- `web/service/knowledge/use-dataset.ts`
- `web/service/knowledge/use-document.ts`

### 模式 5：提取模态框/对话框管理

**何时使用**：组件管理多个具有复杂打开/关闭状态的模态框。

**Dify 约定**：模态框应与其状态管理一起提取。

```typescript
// ❌ Before: 组件中的多个模态框状态
const AppInfo = () => {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showSwitchModal, setShowSwitchModal] = useState(false)
  const [showImportDSLModal, setShowImportDSLModal] = useState(false)
  // 5+ more modal states...
  // 5 个以上更多模态框状态...
}

// ✅ After: 提取到模态框管理 Hook
type ModalType = 'edit' | 'duplicate' | 'delete' | 'switch' | 'import' | null

const useAppInfoModals = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  
  const openModal = useCallback((type: ModalType) => setActiveModal(type), [])
  const closeModal = useCallback(() => setActiveModal(null), [])
  
  return {
    activeModal,
    openModal,
    closeModal,
    isOpen: (type: ModalType) => activeModal === type,
  }
}
```

### 模式 6：提取表单逻辑

**何时使用**：复杂的表单验证、提交处理或字段转换。

**Dify 约定**：使用 `web/app/components/base/form/` 中的 `@tanstack/react-form` 模式。

```typescript
// ✅ Use existing form infrastructure
// ✅ 使用现有的表单基础设施
import { useAppForm } from '@/app/components/base/form'

const ConfigForm = () => {
  const form = useAppForm({
    defaultValues: { name: '', description: '' },
    onSubmit: handleSubmit,
  })
  
  return <form.Provider>...</form.Provider>
}
```

## Dify 特定重构指南

### 1. Context Provider 提取

**何时使用**：组件提供具有多个状态的复杂上下文值。

```typescript
// ❌ Before: 大型上下文值对象
const value = {
  appId, isAPIKeySet, isTrailFinished, mode, modelModeType,
  promptMode, isAdvancedMode, isAgent, isOpenAI, isFunctionCall,
  // 50+ more properties...
  // 50+ 更多属性...
}
return <ConfigContext.Provider value={value}>...</ConfigContext.Provider>

// ✅ After: 拆分为特定领域的上下文
<ModelConfigProvider value={modelConfigValue}>
  <DatasetConfigProvider value={datasetConfigValue}>
    <UIConfigProvider value={uiConfigValue}>
      {children}
    </UIConfigProvider>
  </DatasetConfigProvider>
</ModelConfigProvider>
```

**Dify 参考**：`web/context/` 目录结构

### 2. 工作流节点组件

**何时使用**：重构工作流节点组件 (`web/app/components/workflow/nodes/`)。

**约定**：
- 将节点逻辑保留在 `use-interactions.ts` 中
- 将面板 UI 提取到单独的文件中
- 使用 `_base` 组件作为通用模式

```
nodes/<node-type>/
  ├── index.tsx              # 节点注册
  ├── node.tsx               # 节点可视化组件
  ├── panel.tsx              # 配置面板
  ├── use-interactions.ts    # 节点特定 Hook
  └── types.ts               # 类型定义
```

### 3. 配置组件

**何时使用**：重构应用配置组件。

**约定**：
- 将配置部分分离到子目录中
- 使用 `web/app/components/app/configuration/` 中的现有模式
- 将功能开关保留在专用组件中

### 4. 工具/插件组件

**何时使用**：重构工具相关组件 (`web/app/components/tools/`)。

**约定**：
- 遵循现有的模态框模式
- 使用 `web/service/use-tools.ts` 中的服务 Hook
- 保持提供者特定逻辑隔离

## 重构工作流

### 步骤 1：生成重构提示

```bash
pnpm refactor-component <path>
```

此命令将：
- 分析组件复杂度和功能
- 识别需要的具体重构操作
- 生成 AI 助手提示（在 macOS 上自动复制到剪贴板）
- 根据检测到的模式提供详细要求

### 步骤 2：分析细节

```bash
pnpm analyze-component <path> --json
```

识别：
- 总复杂度得分
- 最大函数复杂度
- 行数
- 检测到的功能（状态、副作用、API 等）

### 步骤 3：计划

根据检测到的功能创建重构计划：

| 检测到的功能 | 重构操作 |
|------------------|-------------------|
| `hasState: true` + `hasEffects: true` | 提取自定义 Hook |
| `hasAPI: true` | 提取数据/服务 Hook |
| `hasEvents: true` (many) | 提取事件处理程序 |
| `lineCount > 300` | 拆分为子组件 |
| `maxComplexity > 50` | 简化条件逻辑 |

### 步骤 4：增量执行

1. **一次提取一个部分**
2. **每次提取后运行 lint、类型检查和测试**
3. **在下一步之前验证功能**

```
对于每次提取:
  ┌────────────────────────────────────────┐
  │ 1. Extract code                        │
  │ 1. 提取代码                            │
  │ 2. Run: pnpm lint:fix                  │
  │ 2. 运行: pnpm lint:fix                 │
  │ 3. Run: pnpm type-check:tsgo           │
  │ 3. 运行: pnpm type-check:tsgo          │
  │ 4. Run: pnpm test                      │
  │ 4. 运行: pnpm test                     │
  │ 5. Test functionality manually         │
  │ 5. 手动测试功能                        │
  │ 6. PASS? → Next extraction             │
  │ 6. 通过? → 下次提取                    │
  │    FAIL? → Fix before continuing       │
  │    失败? → 继续前修复                  │
  └────────────────────────────────────────┘
```

### 步骤 5：验证

重构后：

```bash
# 重新运行重构命令以验证改进
pnpm refactor-component <path>

# 如果复杂度 < 25 且行数 < 200，你会看到：
# ✅ COMPONENT IS WELL-STRUCTURED

# 获取详细指标：
pnpm analyze-component <path> --json

# 目标指标：
# - complexity < 50
# - lineCount < 300
# - maxComplexity < 30
```

## 要避免的常见错误

### ❌ 过度设计

```typescript
// ❌ 太多微小的 Hook
const useButtonText = () => useState('Click')
const useButtonDisabled = () => useState(false)
const useButtonLoading = () => useState(false)

// ✅ 具有相关状态的内聚 Hook
const useButtonState = () => {
  const [text, setText] = useState('Click')
  const [disabled, setDisabled] = useState(false)
  const [loading, setLoading] = useState(false)
  return { text, setText, disabled, setDisabled, loading, setLoading }
}
```

### ❌ 破坏现有模式

- 遵循现有的目录结构
- 保持命名约定
- 保留导出模式以实现兼容性

### ❌ 过早抽象

- 仅在有明显复杂度收益时才提取
- 不要为一次性代码创建抽象
- 将重构的代码保留在同一领域区域

## 参考

### Dify 代码库示例

- **Hook 提取**: `web/app/components/app/configuration/hooks/`
- **组件拆分**: `web/app/components/app/configuration/`
- **服务 Hook**: `web/service/use-*.ts`
- **工作流模式**: `web/app/components/workflow/hooks/`
- **表单模式**: `web/app/components/base/form/`

### 相关技能

- `frontend-testing` - 用于测试重构的组件
- `web/docs/test.md` - 测试规范
