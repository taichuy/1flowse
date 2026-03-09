# 规则目录 — 业务逻辑

## 无法在节点组件中使用 workflowStore

IsUrgent: True

### 描述

节点组件的文件路径模式：`web/app/components/workflow/nodes/[nodeName]/node.tsx`

从模板创建 RAG Pipe 时也会使用节点组件，但在该上下文中没有 workflowStore Provider，这会导致白屏。[此问题](https://github.com/langgenius/dify/issues/29168)正是由这个原因引起的。

### 建议的修复

使用 `import { useNodes } from 'reactflow'` 代替 `import useNodes from '@/app/components/workflow/store/workflow/use-nodes'`。
