# 规则目录 — 代码质量

## 条件类名使用工具函数

IsUrgent: True
Category: 代码质量

### 描述

确保通过共享的 `classNames` 处理条件 CSS，而不是自定义三元运算符、字符串连接或模板字符串。集中类逻辑可保持组件一致且更易于维护。

### 建议的修复

```ts
import { cn } from '@/utils/classnames'
const classNames = cn(isActive ? 'text-primary-600' : 'text-gray-500')
```

## 优先使用 Tailwind 样式

IsUrgent: True
Category: 代码质量

### 描述

优先使用 Tailwind CSS 工具类，而不是添加新的 `.module.css` 文件，除非 Tailwind 组合无法实现所需的样式。将样式保留在 Tailwind 中可提高一致性并减少维护开销。

当添加、编辑或删除代码质量规则时更新此文件，以保持目录准确。

## 便于覆盖的类名顺序

### 描述

编写组件时，始终将传入的 `className` prop 放在组件自己的类值之后，以便下游使用者可以覆盖或扩展样式。这保留了组件的默认值，但仍允许外部调用者更改或删除特定样式。

示例：

```tsx
import { cn } from '@/utils/classnames'

const Button = ({ className }) => {
  return <div className={cn('bg-primary-600', className)}></div>
}
```
