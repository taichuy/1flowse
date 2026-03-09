# 组件拆分模式

本文档提供了在 Dify 中将大型组件拆分为更小、更专注组件的详细指南。

## 何时拆分组件

当你发现以下情况时拆分组件：

1. **多个 UI 部分** - 具有最小耦合的独特视觉区域，可以独立组合
1. **条件渲染块** - 大型 `{condition && <JSX />}` 块
1. **重复模式** - 多次使用的类似 UI 结构
1. **300+ 行** - 组件超过可管理大小
1. **模态框集群** - 在一个组件中渲染多个模态框

## 拆分策略

### 策略 1：基于部分的拆分

识别视觉部分并将每个部分提取为一个组件。

```typescript
// ❌ Before: 单体组件 (500+ 行)
const ConfigurationPage = () => {
  return (
    <div>
      {/* Header Section - 50 lines */}
      {/* 标题部分 - 50 行 */}
      <div className="header">
        <h1>{t('configuration.title')}</h1>
        <div className="actions">
          {isAdvancedMode && <Badge>Advanced</Badge>}
          <ModelParameterModal ... />
          <AppPublisher ... />
        </div>
      </div>
      
      {/* Config Section - 200 lines */}
      {/* 配置部分 - 200 行 */}
      <div className="config">
        <Config />
      </div>
      
      {/* Debug Section - 150 lines */}
      {/* 调试部分 - 150 行 */}
      <div className="debug">
        <Debug ... />
      </div>
      
      {/* Modals Section - 100 lines */}
      {/* 模态框部分 - 100 行 */}
      {showSelectDataSet && <SelectDataSet ... />}
      {showHistoryModal && <EditHistoryModal ... />}
      {showUseGPT4Confirm && <Confirm ... />}
    </div>
  )
}

// ✅ After: 拆分为专注的组件
// configuration/
//   ├── index.tsx              (编排)
//   ├── configuration-header.tsx
//   ├── configuration-content.tsx
//   ├── configuration-debug.tsx
//   └── configuration-modals.tsx

// configuration-header.tsx
interface ConfigurationHeaderProps {
  isAdvancedMode: boolean
  onPublish: () => void
}

const ConfigurationHeader: FC<ConfigurationHeaderProps> = ({
  isAdvancedMode,
  onPublish,
}) => {
  const { t } = useTranslation()
  
  return (
    <div className="header">
      <h1>{t('configuration.title')}</h1>
      <div className="actions">
        {isAdvancedMode && <Badge>Advanced</Badge>}
        <ModelParameterModal ... />
        <AppPublisher onPublish={onPublish} />
      </div>
    </div>
  )
}

// index.tsx (orchestration only)
// index.tsx (仅编排)
const ConfigurationPage = () => {
  const { modelConfig, setModelConfig } = useModelConfig()
  const { activeModal, openModal, closeModal } = useModalState()
  
  return (
    <div>
      <ConfigurationHeader
        isAdvancedMode={isAdvancedMode}
        onPublish={handlePublish}
      />
      <ConfigurationContent
        modelConfig={modelConfig}
        onConfigChange={setModelConfig}
      />
      {!isMobile && (
        <ConfigurationDebug
          inputs={inputs}
          onSetting={handleSetting}
        />
      )}
      <ConfigurationModals
        activeModal={activeModal}
        onClose={closeModal}
      />
    </div>
  )
}
```

### 策略 2：条件块提取

提取大型条件渲染块。

```typescript
// ❌ Before: 大型条件块
const AppInfo = () => {
  return (
    <div>
      {expand ? (
        <div className="expanded">
          {/* 100 lines of expanded view */}
          {/* 100 行展开视图 */}
        </div>
      ) : (
        <div className="collapsed">
          {/* 50 lines of collapsed view */}
          {/* 50 行折叠视图 */}
        </div>
      )}
    </div>
  )
}

// ✅ After: 分离视图组件
const AppInfoExpanded: FC<AppInfoViewProps> = ({ appDetail, onAction }) => {
  return (
    <div className="expanded">
      {/* Clean, focused expanded view */}
      {/* 整洁、专注的展开视图 */}
    </div>
  )
}

const AppInfoCollapsed: FC<AppInfoViewProps> = ({ appDetail, onAction }) => {
  return (
    <div className="collapsed">
      {/* Clean, focused collapsed view */}
      {/* 整洁、专注的折叠视图 */}
    </div>
  )
}

const AppInfo = () => {
  return (
    <div>
      {expand
        ? <AppInfoExpanded appDetail={appDetail} onAction={handleAction} />
        : <AppInfoCollapsed appDetail={appDetail} onAction={handleAction} />
      }
    </div>
  )
}
```

### 策略 3：模态框提取

提取模态框及其触发逻辑。

```typescript
// ❌ Before: 一个组件中有多个模态框
const AppInfo = () => {
  const [showEdit, setShowEdit] = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showSwitch, setShowSwitch] = useState(false)
  
  const onEdit = async (data) => { /* 20 lines */ }
  const onDuplicate = async (data) => { /* 20 lines */ }
  const onDelete = async () => { /* 15 lines */ }
  
  return (
    <div>
      {/* Main content */}
      {/* 主要内容 */}
      
      {showEdit && <EditModal onConfirm={onEdit} onClose={() => setShowEdit(false)} />}
      {showDuplicate && <DuplicateModal onConfirm={onDuplicate} onClose={() => setShowDuplicate(false)} />}
      {showDelete && <DeleteConfirm onConfirm={onDelete} onClose={() => setShowDelete(false)} />}
      {showSwitch && <SwitchModal ... />}
    </div>
  )
}

// ✅ After: 模态框管理组件
// app-info-modals.tsx
type ModalType = 'edit' | 'duplicate' | 'delete' | 'switch' | null

interface AppInfoModalsProps {
  appDetail: AppDetail
  activeModal: ModalType
  onClose: () => void
  onSuccess: () => void
}

const AppInfoModals: FC<AppInfoModalsProps> = ({
  appDetail,
  activeModal,
  onClose,
  onSuccess,
}) => {
  const handleEdit = async (data) => { /* logic */ }
  const handleDuplicate = async (data) => { /* logic */ }
  const handleDelete = async () => { /* logic */ }

  return (
    <>
      {activeModal === 'edit' && (
        <EditModal
          appDetail={appDetail}
          onConfirm={handleEdit}
          onClose={onClose}
        />
      )}
      {activeModal === 'duplicate' && (
        <DuplicateModal
          appDetail={appDetail}
          onConfirm={handleDuplicate}
          onClose={onClose}
        />
      )}
      {activeModal === 'delete' && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onClose={onClose}
        />
      )}
      {activeModal === 'switch' && (
        <SwitchModal
          appDetail={appDetail}
          onClose={onClose}
        />
      )}
    </>
  )
}

// Parent component
// 父组件
const AppInfo = () => {
  const { activeModal, openModal, closeModal } = useModalState()
  
  return (
    <div>
      {/* Main content with openModal triggers */}
      {/* 带有 openModal 触发器的主要内容 */}
      <Button onClick={() => openModal('edit')}>Edit</Button>
      
      <AppInfoModals
        appDetail={appDetail}
        activeModal={activeModal}
        onClose={closeModal}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
```

### 策略 4：列表项提取

提取重复的项渲染。

```typescript
// ❌ Before: 内联项渲染
const OperationsList = () => {
  return (
    <div>
      {operations.map(op => (
        <div key={op.id} className="operation-item">
          <span className="icon">{op.icon}</span>
          <span className="title">{op.title}</span>
          <span className="description">{op.description}</span>
          <button onClick={() => op.onClick()}>
            {op.actionLabel}
          </button>
          {op.badge && <Badge>{op.badge}</Badge>}
          {/* More complex rendering... */}
          {/* 更复杂的渲染... */}
        </div>
      ))}
    </div>
  )
}

// ✅ After: 提取项组件
interface OperationItemProps {
  operation: Operation
  onAction: (id: string) => void
}

const OperationItem: FC<OperationItemProps> = ({ operation, onAction }) => {
  return (
    <div className="operation-item">
      <span className="icon">{operation.icon}</span>
      <span className="title">{operation.title}</span>
      <span className="description">{operation.description}</span>
      <button onClick={() => onAction(operation.id)}>
        {operation.actionLabel}
      </button>
      {operation.badge && <Badge>{operation.badge}</Badge>}
    </div>
  )
}

const OperationsList = () => {
  const handleAction = useCallback((id: string) => {
    const op = operations.find(o => o.id === id)
    op?.onClick()
  }, [operations])

  return (
    <div>
      {operations.map(op => (
        <OperationItem
          key={op.id}
          operation={op}
          onAction={handleAction}
        />
      ))}
    </div>
  )
}
```

## 目录结构模式

### 模式 A：扁平结构（简单组件）

对于具有 2-3 个子组件的组件：

```
component-name/
  ├── index.tsx           # 主组件
  ├── sub-component-a.tsx
  ├── sub-component-b.tsx
  └── types.ts            # 共享类型
```

### 模式 B：嵌套结构（复杂组件）

对于具有许多子组件的组件：

```
component-name/
  ├── index.tsx           # 主编排
  ├── types.ts            # 共享类型
  ├── hooks/
  │   ├── use-feature-a.ts
  │   └── use-feature-b.ts
  ├── components/
  │   ├── header/
  │   │   └── index.tsx
  │   ├── content/
  │   │   └── index.tsx
  │   └── modals/
  │       └── index.tsx
  └── utils/
      └── helpers.ts
```

### 模式 C：基于功能的结构（Dify 标准）

遵循 Dify 现有的模式：

```
configuration/
  ├── index.tsx           # 主页面组件
  ├── base/               # 基础/共享组件
  │   ├── feature-panel/
  │   ├── group-name/
  │   └── operation-btn/
  ├── config/             # 配置部分
  │   ├── index.tsx
  │   ├── agent/
  │   └── automatic/
  ├── dataset-config/     # 数据集部分
  │   ├── index.tsx
  │   ├── card-item/
  │   └── params-config/
  ├── debug/              # 调试部分
  │   ├── index.tsx
  │   └── hooks.tsx
  └── hooks/              # 共享 Hook
      └── use-advanced-prompt-config.ts
```

## Props 设计

### 最小 Props 原则

仅传递所需内容：

```typescript
// ❌ Bad: 仅需要某些字段时传递整个对象
<ConfigHeader appDetail={appDetail} modelConfig={modelConfig} />

// ✅ Good: 解构为最小需求
<ConfigHeader
  appName={appDetail.name}
  isAdvancedMode={modelConfig.isAdvanced}
  onPublish={handlePublish}
/>
```

### 回调 Props 模式

使用回调进行子对父通信：

```typescript
// Parent
const Parent = () => {
  const [value, setValue] = useState('')
  
  return (
    <Child
      value={value}
      onChange={setValue}
      onSubmit={handleSubmit}
    />
  )
}

// Child
interface ChildProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

const Child: FC<ChildProps> = ({ value, onChange, onSubmit }) => {
  return (
    <div>
      <input value={value} onChange={e => onChange(e.target.value)} />
      <button onClick={onSubmit}>Submit</button>
    </div>
  )
}
```

### 渲染 Props 灵活性

当子组件需要父上下文时：

```typescript
interface ListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  renderEmpty?: () => React.ReactNode
}

function List<T>({ items, renderItem, renderEmpty }: ListProps<T>) {
  if (items.length === 0 && renderEmpty) {
    return <>{renderEmpty()}</>
  }
  
  return (
    <div>
      {items.map((item, index) => renderItem(item, index))}
    </div>
  )
}

// Usage
// 用法
<List
  items={operations}
  renderItem={(op, i) => <OperationItem key={i} operation={op} />}
  renderEmpty={() => <EmptyState message="No operations" />}
/>
```
