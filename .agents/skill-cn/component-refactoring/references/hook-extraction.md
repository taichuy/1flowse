# Hook 提取模式

本文档提供了从 Dify 中的复杂组件中提取自定义 Hook 的详细指南。

## 何时提取 Hook

当你发现以下情况时提取自定义 Hook：

1. **耦合状态组** - 总是起使用的多个 `useState` Hook
1. **复杂副作用** - 具有多个依赖项或清理逻辑的 `useEffect`
1. **业务逻辑** - 数据转换、验证或计算
1. **可重用模式** - 出现在多个组件中的逻辑

## 提取流程

### 步骤 1：识别状态组

寻找逻辑上相关的状态变量：

```typescript
// ❌ 它们属于一起 - 提取到 Hook
const [modelConfig, setModelConfig] = useState<ModelConfig>(...)
const [completionParams, setCompletionParams] = useState<FormValue>({})
const [modelModeType, setModelModeType] = useState<ModelModeType>(...)

// These are model-related state that should be in useModelConfig()
// 这些是应该在 useModelConfig() 中的模型相关状态
```

### 步骤 2：识别相关副作用

查找修改分组状态的副作用：

```typescript
// ❌ 这些副作用属于上面的状态
useEffect(() => {
  if (hasFetchedDetail && !modelModeType) {
    const mode = currModel?.model_properties.mode
    if (mode) {
      const newModelConfig = produce(modelConfig, (draft) => {
        draft.mode = mode
      })
      setModelConfig(newModelConfig)
    }
  }
}, [textGenerationModelList, hasFetchedDetail, modelModeType, currModel])
```

### 步骤 3：创建 Hook

```typescript
// hooks/use-model-config.ts
import type { FormValue } from '@/app/components/header/account-setting/model-provider-page/declarations'
import type { ModelConfig } from '@/models/debug'
import { produce } from 'immer'
import { useEffect, useState } from 'react'
import { ModelModeType } from '@/types/app'

interface UseModelConfigParams {
  initialConfig?: Partial<ModelConfig>
  currModel?: { model_properties?: { mode?: ModelModeType } }
  hasFetchedDetail: boolean
}

interface UseModelConfigReturn {
  modelConfig: ModelConfig
  setModelConfig: (config: ModelConfig) => void
  completionParams: FormValue
  setCompletionParams: (params: FormValue) => void
  modelModeType: ModelModeType
}

export const useModelConfig = ({
  initialConfig,
  currModel,
  hasFetchedDetail,
}: UseModelConfigParams): UseModelConfigReturn => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'langgenius/openai/openai',
    model_id: 'gpt-3.5-turbo',
    mode: ModelModeType.unset,
    // ... default values
    // ... 默认值
    ...initialConfig,
  })
  
  const [completionParams, setCompletionParams] = useState<FormValue>({})
  
  const modelModeType = modelConfig.mode

  // Fill old app data missing model mode
  // 填充缺失模型模式的旧应用数据
  useEffect(() => {
    if (hasFetchedDetail && !modelModeType) {
      const mode = currModel?.model_properties?.mode
      if (mode) {
        setModelConfig(produce(modelConfig, (draft) => {
          draft.mode = mode
        }))
      }
    }
  }, [hasFetchedDetail, modelModeType, currModel])

  return {
    modelConfig,
    setModelConfig,
    completionParams,
    setCompletionParams,
    modelModeType,
  }
}
```

### 步骤 4：更新组件

```typescript
// Before: 50+ lines of state management
// Before: 50+ 行状态管理
const Configuration: FC = () => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(...)
  // ... lots of related state and effects
  // ... 许多相关状态和副作用
}

// After: Clean component
// After: 整洁的组件
const Configuration: FC = () => {
  const {
    modelConfig,
    setModelConfig,
    completionParams,
    setCompletionParams,
    modelModeType,
  } = useModelConfig({
    currModel,
    hasFetchedDetail,
  })
  
  // Component now focuses on UI
  // 组件现在专注于 UI
}
```

## 命名约定

### Hook 名称

- 使用 `use` 前缀：`useModelConfig`、`useDatasetConfig`
- 具体化：`useAdvancedPromptConfig` 而不是 `usePrompt`
- 包含领域：`useWorkflowVariables`、`useMCPServer`

### 文件名

- Kebab-case：`use-model-config.ts`
- 当存在多个 Hook 时，放置在 `hooks/` 子目录中
- 对于一次性 Hook，放置在组件旁边

### 返回类型名称

- 后缀 `Return`：`UseModelConfigReturn`
- 参数后缀 `Params`：`UseModelConfigParams`

## Dify 中的常见 Hook 模式

### 1. 数据获取 Hook (React Query)

```typescript
// Pattern: Use @tanstack/react-query for data fetching
// 模式：使用 @tanstack/react-query 进行数据获取
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { get } from '@/service/base'
import { useInvalid } from '@/service/use-base'

const NAME_SPACE = 'appConfig'

// Query keys for cache management
// 用于缓存管理的查询键
export const appConfigQueryKeys = {
  detail: (appId: string) => [NAME_SPACE, 'detail', appId] as const,
}

// Main data hook
// 主数据 Hook
export const useAppConfig = (appId: string) => {
  return useQuery({
    enabled: !!appId,
    queryKey: appConfigQueryKeys.detail(appId),
    queryFn: () => get<AppDetailResponse>(`/apps/${appId}`),
    select: data => data?.model_config || null,
  })
}

// Invalidation hook for refreshing data
// 用于刷新数据的失效 Hook
export const useInvalidAppConfig = () => {
  return useInvalid([NAME_SPACE])
}

// Usage in component
// 在组件中使用
const Component = () => {
  const { data: config, isLoading, error, refetch } = useAppConfig(appId)
  const invalidAppConfig = useInvalidAppConfig()
  
  const handleRefresh = () => {
    invalidAppConfig() // Invalidates cache and triggers refetch (使缓存失效并触发重新获取)
  }
  
  return <div>...</div>
}
```

### 2. 表单状态 Hook

```typescript
// Pattern: Form state + validation + submission
// 模式：表单状态 + 验证 + 提交
export const useConfigForm = (initialValues: ConfigFormValues) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {}
    if (!values.name) newErrors.name = 'Name is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [values])

  const handleChange = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = useCallback(async (onSubmit: (values: ConfigFormValues) => Promise<void>) => {
    if (!validate()) return
    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validate])

  return { values, errors, isSubmitting, handleChange, handleSubmit }
}
```

### 3. 模态框状态 Hook

```typescript
// Pattern: Multiple modal management
// 模式：多个模态框管理
type ModalType = 'edit' | 'delete' | 'duplicate' | null

export const useModalState = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [modalData, setModalData] = useState<any>(null)

  const openModal = useCallback((type: ModalType, data?: any) => {
    setActiveModal(type)
    setModalData(data)
  }, [])

  const closeModal = useCallback(() => {
    setActiveModal(null)
    setModalData(null)
  }, [])

  return {
    activeModal,
    modalData,
    openModal,
    closeModal,
    isOpen: useCallback((type: ModalType) => activeModal === type, [activeModal]),
  }
}
```

### 4. 切换/布尔 Hook

```typescript
// Pattern: Boolean state with convenience methods
// 模式：具有便捷方法的布尔状态
export const useToggle = (initialValue = false) => {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => setValue(v => !v), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])

  return [value, { toggle, setTrue, setFalse, set: setValue }] as const
}

// Usage
// 用法
const [isExpanded, { toggle, setTrue: expand, setFalse: collapse }] = useToggle()
```

## 测试提取的 Hook

提取后，单独测试 Hook：

```typescript
// use-model-config.spec.ts
import { renderHook, act } from '@testing-library/react'
import { useModelConfig } from './use-model-config'

describe('useModelConfig', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useModelConfig({
      hasFetchedDetail: false,
    }))

    expect(result.current.modelConfig.provider).toBe('langgenius/openai/openai')
    expect(result.current.modelModeType).toBe(ModelModeType.unset)
  })

  it('should update model config', () => {
    const { result } = renderHook(() => useModelConfig({
      hasFetchedDetail: true,
    }))

    act(() => {
      result.current.setModelConfig({
        ...result.current.modelConfig,
        model_id: 'gpt-4',
      })
    })

    expect(result.current.modelConfig.model_id).toBe('gpt-4')
  })
})
```
