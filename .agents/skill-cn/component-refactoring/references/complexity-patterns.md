# 复杂度降低模式

本文档提供了降低 Dify React 组件中认知复杂度的模式。

## 理解复杂度

### SonarJS 认知复杂度

`pnpm analyze-component` 工具使用 SonarJS 认知复杂度指标：

- **总复杂度**：文件中所有函数的复杂度总和
- **最大复杂度**：单个函数的最高复杂度

### 什么会增加复杂度

| 模式 | 复杂度影响 |
|---------|-------------------|
| `if/else` | 每个分支 +1 |
| 嵌套条件 | 每个嵌套层级 +1 |
| `switch/case` | 每个 case +1 |
| `for/while/do` | 每个循环 +1 |
| `&&`/`||` 链 | 每个运算符 +1 |
| 嵌套回调 | 每个嵌套层级 +1 |
| `try/catch` | 每个 catch +1 |
| 三元表达式 | 每个嵌套 +1 |

## 模式 1：用查找表替换条件语句

**Before** (复杂度: ~15):

```typescript
const Template = useMemo(() => {
  if (appDetail?.mode === AppModeEnum.CHAT) {
    switch (locale) {
      case LanguagesSupported[1]:
        return <TemplateChatZh appDetail={appDetail} />
      case LanguagesSupported[7]:
        return <TemplateChatJa appDetail={appDetail} />
      default:
        return <TemplateChatEn appDetail={appDetail} />
    }
  }
  if (appDetail?.mode === AppModeEnum.ADVANCED_CHAT) {
    switch (locale) {
      case LanguagesSupported[1]:
        return <TemplateAdvancedChatZh appDetail={appDetail} />
      case LanguagesSupported[7]:
        return <TemplateAdvancedChatJa appDetail={appDetail} />
      default:
        return <TemplateAdvancedChatEn appDetail={appDetail} />
    }
  }
  if (appDetail?.mode === AppModeEnum.WORKFLOW) {
    // Similar pattern...
    // 类似模式...
  }
  return null
}, [appDetail, locale])
```

**After** (复杂度: ~3):

```typescript
// Define lookup table outside component
// 在组件外部定义查找表
const TEMPLATE_MAP: Record<AppModeEnum, Record<string, FC<TemplateProps>>> = {
  [AppModeEnum.CHAT]: {
    [LanguagesSupported[1]]: TemplateChatZh,
    [LanguagesSupported[7]]: TemplateChatJa,
    default: TemplateChatEn,
  },
  [AppModeEnum.ADVANCED_CHAT]: {
    [LanguagesSupported[1]]: TemplateAdvancedChatZh,
    [LanguagesSupported[7]]: TemplateAdvancedChatJa,
    default: TemplateAdvancedChatEn,
  },
  [AppModeEnum.WORKFLOW]: {
    [LanguagesSupported[1]]: TemplateWorkflowZh,
    [LanguagesSupported[7]]: TemplateWorkflowJa,
    default: TemplateWorkflowEn,
  },
  // ...
}

// Clean component logic
// 整洁的组件逻辑
const Template = useMemo(() => {
  if (!appDetail?.mode) return null
  
  const templates = TEMPLATE_MAP[appDetail.mode]
  if (!templates) return null
  
  const TemplateComponent = templates[locale] ?? templates.default
  return <TemplateComponent appDetail={appDetail} />
}, [appDetail, locale])
```

## 模式 2：使用提前返回

**Before** (复杂度: ~10):

```typescript
const handleSubmit = () => {
  if (isValid) {
    if (hasChanges) {
      if (isConnected) {
        submitData()
      } else {
        showConnectionError()
      }
    } else {
      showNoChangesMessage()
    }
  } else {
    showValidationError()
  }
}
```

**After** (复杂度: ~4):

```typescript
const handleSubmit = () => {
  if (!isValid) {
    showValidationError()
    return
  }
  
  if (!hasChanges) {
    showNoChangesMessage()
    return
  }
  
  if (!isConnected) {
    showConnectionError()
    return
  }
  
  submitData()
}
```

## 模式 3：提取复杂条件

**Before** (复杂度: 高):

```typescript
const canPublish = (() => {
  if (mode !== AppModeEnum.COMPLETION) {
    if (!isAdvancedMode)
      return true

    if (modelModeType === ModelModeType.completion) {
      if (!hasSetBlockStatus.history || !hasSetBlockStatus.query)
        return false
      return true
    }
    return true
  }
  return !promptEmpty
})()
```

**After** (复杂度: 较低):

```typescript
// Extract to named functions
// 提取到命名函数
const canPublishInCompletionMode = () => !promptEmpty

const canPublishInChatMode = () => {
  if (!isAdvancedMode) return true
  if (modelModeType !== ModelModeType.completion) return true
  return hasSetBlockStatus.history && hasSetBlockStatus.query
}

// Clean main logic
// 整洁的主逻辑
const canPublish = mode === AppModeEnum.COMPLETION
  ? canPublishInCompletionMode()
  : canPublishInChatMode()
```

## 模式 4：替换链式三元运算符

**Before** (复杂度: ~5):

```typescript
const statusText = serverActivated
  ? t('status.running')
  : serverPublished
    ? t('status.inactive')
    : appUnpublished
      ? t('status.unpublished')
      : t('status.notConfigured')
```

**After** (复杂度: ~2):

```typescript
const getStatusText = () => {
  if (serverActivated) return t('status.running')
  if (serverPublished) return t('status.inactive')
  if (appUnpublished) return t('status.unpublished')
  return t('status.notConfigured')
}

const statusText = getStatusText()
```

或者使用查找：

```typescript
const STATUS_TEXT_MAP = {
  running: 'status.running',
  inactive: 'status.inactive',
  unpublished: 'status.unpublished',
  notConfigured: 'status.notConfigured',
} as const

const getStatusKey = (): keyof typeof STATUS_TEXT_MAP => {
  if (serverActivated) return 'running'
  if (serverPublished) return 'inactive'
  if (appUnpublished) return 'unpublished'
  return 'notConfigured'
}

const statusText = t(STATUS_TEXT_MAP[getStatusKey()])
```

## 模式 5：扁平化嵌套循环

**Before** (复杂度: 高):

```typescript
const processData = (items: Item[]) => {
  const results: ProcessedItem[] = []
  
  for (const item of items) {
    if (item.isValid) {
      for (const child of item.children) {
        if (child.isActive) {
          for (const prop of child.properties) {
            if (prop.value !== null) {
              results.push({
                itemId: item.id,
                childId: child.id,
                propValue: prop.value,
              })
            }
          }
        }
      }
    }
  }
  
  return results
}
```

**After** (复杂度: 较低):

```typescript
// Use functional approach
// 使用函数式方法
const processData = (items: Item[]) => {
  return items
    .filter(item => item.isValid)
    .flatMap(item =>
      item.children
        .filter(child => child.isActive)
        .flatMap(child =>
          child.properties
            .filter(prop => prop.value !== null)
            .map(prop => ({
              itemId: item.id,
              childId: child.id,
              propValue: prop.value,
            }))
        )
    )
}
```

## 模式 6：提取事件处理程序逻辑

**Before** (组件内复杂度高):

```typescript
const Component = () => {
  const handleSelect = (data: DataSet[]) => {
    if (isEqual(data.map(item => item.id), dataSets.map(item => item.id))) {
      hideSelectDataSet()
      return
    }

    formattingChangedDispatcher()
    let newDatasets = data
    if (data.find(item => !item.name)) {
      const newSelected = produce(data, (draft) => {
        data.forEach((item, index) => {
          if (!item.name) {
            const newItem = dataSets.find(i => i.id === item.id)
            if (newItem)
              draft[index] = newItem
          }
        })
      })
      setDataSets(newSelected)
      newDatasets = newSelected
    }
    else {
      setDataSets(data)
    }
    hideSelectDataSet()
    
    // 40 more lines of logic...
    // 40 多行逻辑...
  }
  
  return <div>...</div>
}
```

**After** (复杂度: 较低):

```typescript
// Extract to hook or utility
// 提取到 Hook 或工具函数
const useDatasetSelection = (dataSets: DataSet[], setDataSets: SetState<DataSet[]>) => {
  const normalizeSelection = (data: DataSet[]) => {
    const hasUnloadedItem = data.some(item => !item.name)
    if (!hasUnloadedItem) return data
    
    return produce(data, (draft) => {
      data.forEach((item, index) => {
        if (!item.name) {
          const existing = dataSets.find(i => i.id === item.id)
          if (existing) draft[index] = existing
        }
      })
    })
  }
  
  const hasSelectionChanged = (newData: DataSet[]) => {
    return !isEqual(
      newData.map(item => item.id),
      dataSets.map(item => item.id)
    )
  }
  
  return { normalizeSelection, hasSelectionChanged }
}

// Component becomes cleaner
// 组件变得更整洁
const Component = () => {
  const { normalizeSelection, hasSelectionChanged } = useDatasetSelection(dataSets, setDataSets)
  
  const handleSelect = (data: DataSet[]) => {
    if (!hasSelectionChanged(data)) {
      hideSelectDataSet()
      return
    }
    
    formattingChangedDispatcher()
    const normalized = normalizeSelection(data)
    setDataSets(normalized)
    hideSelectDataSet()
  }
  
  return <div>...</div>
}
```

## 模式 7：降低布尔逻辑复杂度

**Before** (复杂度: ~8):

```typescript
const toggleDisabled = hasInsufficientPermissions
  || appUnpublished
  || missingStartNode
  || triggerModeDisabled
  || (isAdvancedApp && !currentWorkflow?.graph)
  || (isBasicApp && !basicAppConfig.updated_at)
```

**After** (复杂度: ~3):

```typescript
// Extract meaningful boolean functions
// 提取有意义的布尔函数
const isAppReady = () => {
  if (isAdvancedApp) return !!currentWorkflow?.graph
  return !!basicAppConfig.updated_at
}

const hasRequiredPermissions = () => {
  return isCurrentWorkspaceEditor && !hasInsufficientPermissions
}

const canToggle = () => {
  if (!hasRequiredPermissions()) return false
  if (!isAppReady()) return false
  if (missingStartNode) return false
  if (triggerModeDisabled) return false
  return true
}

const toggleDisabled = !canToggle()
```

## 模式 8：简化 useMemo/useCallback 依赖

**Before** (复杂度: 多次重新计算):

```typescript
const payload = useMemo(() => {
  let parameters: Parameter[] = []
  let outputParameters: OutputParameter[] = []

  if (!published) {
    parameters = (inputs || []).map((item) => ({
      name: item.variable,
      description: '',
      form: 'llm',
      required: item.required,
      type: item.type,
    }))
    outputParameters = (outputs || []).map((item) => ({
      name: item.variable,
      description: '',
      type: item.value_type,
    }))
  }
  else if (detail && detail.tool) {
    parameters = (inputs || []).map((item) => ({
      // Complex transformation...
      // 复杂转换...
    }))
    outputParameters = (outputs || []).map((item) => ({
      // Complex transformation...
      // 复杂转换...
    }))
  }
  
  return {
    icon: detail?.icon || icon,
    label: detail?.label || name,
    // ...more fields
    // ...更多字段
  }
}, [detail, published, workflowAppId, icon, name, description, inputs, outputs])
```

**After** (复杂度: 分离关注点):

```typescript
// Separate transformations
// 分离转换
const useParameterTransform = (inputs: InputVar[], detail?: ToolDetail, published?: boolean) => {
  return useMemo(() => {
    if (!published) {
      return inputs.map(item => ({
        name: item.variable,
        description: '',
        form: 'llm',
        required: item.required,
        type: item.type,
      }))
    }
    
    if (!detail?.tool) return []
    
    return inputs.map(item => ({
      name: item.variable,
      required: item.required,
      type: item.type === 'paragraph' ? 'string' : item.type,
      description: detail.tool.parameters.find(p => p.name === item.variable)?.llm_description || '',
      form: detail.tool.parameters.find(p => p.name === item.variable)?.form || 'llm',
    }))
  }, [inputs, detail, published])
}

// Component uses hook
// 组件使用 Hook
const parameters = useParameterTransform(inputs, detail, published)
const outputParameters = useOutputTransform(outputs, detail, published)

const payload = useMemo(() => ({
  icon: detail?.icon || icon,
  label: detail?.label || name,
  parameters,
  outputParameters,
  // ...
}), [detail, icon, name, parameters, outputParameters])
```

## 重构后的目标指标

| 指标 | 目标 |
|--------|--------|
| 总复杂度 | < 50 |
| 最大函数复杂度 | < 30 |
| 函数长度 | < 30 lines |
| 嵌套深度 | ≤ 3 levels |
| 条件链 | ≤ 3 conditions |
