# 规则目录 — 性能

## React Flow 数据使用

IsUrgent: True
Category: 性能

### 描述

渲染 React Flow 时，优先使用 `useNodes`/`useEdges` 进行 UI 消费，并在变更或读取节点/边状态的回调内部依赖 `useStoreApi`。避免在这些 Hook 之外手动拉取 Flow 数据。

## 复杂 prop 记忆化

IsUrgent: True
Category: 性能

### 描述

在将复杂的 prop 值（对象、数组、映射）传递给子组件之前，将其包装在 `useMemo` 中，以保证稳定的引用并防止不必要的渲染。

当添加、编辑或删除性能规则时更新此文件，以保持目录准确。

错误：

```tsx
<HeavyComp
    config={{
        provider: ...,
        detail: ...
    }}
/>
```

正确：

```tsx
const config = useMemo(() => ({
    provider: ...,
    detail: ...
}), [provider, detail]);

<HeavyComp
    config={config}
/>
```
