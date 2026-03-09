# 领域特定组件测试

本指南涵盖了 Dify 领域特定组件的测试模式。

## 工作流组件 (`workflow/`)

工作流组件处理节点配置、数据流和图操作。

### 关键测试领域

1. **节点配置**
1. **数据验证**
1. **变量传递**
1. **边连接**
1. **错误处理**

### 示例：节点配置面板

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NodeConfigPanel from './node-config-panel'
import { createMockNode, createMockWorkflowContext } from '@/__mocks__/workflow'

// Mock workflow context
// Mock 工作流上下文
vi.mock('@/app/components/workflow/hooks', () => ({
  useWorkflowStore: () => mockWorkflowStore,
  useNodesInteractions: () => mockNodesInteractions,
}))

let mockWorkflowStore = {
  nodes: [],
  edges: [],
  updateNode: vi.fn(),
}

let mockNodesInteractions = {
  handleNodeSelect: vi.fn(),
  handleNodeDelete: vi.fn(),
}

describe('NodeConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowStore = {
      nodes: [],
      edges: [],
      updateNode: vi.fn(),
    }
  })

  describe('Node Configuration', () => {
    it('should render node type selector', () => {
      const node = createMockNode({ type: 'llm' })
      render(<NodeConfigPanel node={node} />)
      
      expect(screen.getByLabelText(/model/i)).toBeInTheDocument()
    })

    it('should update node config on change', async () => {
      const user = userEvent.setup()
      const node = createMockNode({ type: 'llm' })
      
      render(<NodeConfigPanel node={node} />)
      
      await user.selectOptions(screen.getByLabelText(/model/i), 'gpt-4')
      
      expect(mockWorkflowStore.updateNode).toHaveBeenCalledWith(
        node.id,
        expect.objectContaining({ model: 'gpt-4' })
      )
    })
  })

  describe('Data Validation', () => {
    it('should show error for invalid input', async () => {
      const user = userEvent.setup()
      const node = createMockNode({ type: 'code' })
      
      render(<NodeConfigPanel node={node} />)
      
      // Enter invalid code
      // 输入无效代码
      const codeInput = screen.getByLabelText(/code/i)
      await user.clear(codeInput)
      await user.type(codeInput, 'invalid syntax {{{')
      
      await waitFor(() => {
        expect(screen.getByText(/syntax error/i)).toBeInTheDocument()
      })
    })

    it('should validate required fields', async () => {
      const node = createMockNode({ type: 'http', data: { url: '' } })
      
      render(<NodeConfigPanel node={node} />)
      
      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/url is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Variable Passing', () => {
    it('should display available variables from upstream nodes', () => {
      const upstreamNode = createMockNode({
        id: 'node-1',
        type: 'start',
        data: { outputs: [{ name: 'user_input', type: 'string' }] },
      })
      const currentNode = createMockNode({
        id: 'node-2',
        type: 'llm',
      })
      
      mockWorkflowStore.nodes = [upstreamNode, currentNode]
      mockWorkflowStore.edges = [{ source: 'node-1', target: 'node-2' }]
      
      render(<NodeConfigPanel node={currentNode} />)
      
      // Variable selector should show upstream variables
      // 变量选择器应显示上游变量
      fireEvent.click(screen.getByRole('button', { name: /add variable/i }))
      
      expect(screen.getByText('user_input')).toBeInTheDocument()
    })

    it('should insert variable into prompt template', async () => {
      const user = userEvent.setup()
      const node = createMockNode({ type: 'llm' })
      
      render(<NodeConfigPanel node={node} />)
      
      // Click variable button
      // 点击变量按钮
      await user.click(screen.getByRole('button', { name: /insert variable/i }))
      await user.click(screen.getByText('user_input'))
      
      const promptInput = screen.getByLabelText(/prompt/i)
      expect(promptInput).toHaveValue(expect.stringContaining('{{user_input}}'))
    })
  })
})
```

## 数据集组件 (`dataset/`)

数据集组件处理文件上传、数据显示和搜索/过滤操作。

### 关键测试领域

1. **文件上传**
1. **文件类型验证**
1. **分页**
1. **搜索和过滤**
1. **数据格式处理**

### 示例：文档上传器

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentUploader from './document-uploader'

vi.mock('@/service/datasets', () => ({
  uploadDocument: vi.fn(),
  parseDocument: vi.fn(),
}))

import * as datasetService from '@/service/datasets'
const mockedService = vi.mocked(datasetService)

describe('DocumentUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('File Upload', () => {
    it('should accept valid file types', async () => {
      const user = userEvent.setup()
      const onUpload = vi.fn()
      mockedService.uploadDocument.mockResolvedValue({ id: 'doc-1' })
      
      render(<DocumentUploader onUpload={onUpload} />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const input = screen.getByLabelText(/upload/i)
      
      await user.upload(input, file)
      
      await waitFor(() => {
        expect(mockedService.uploadDocument).toHaveBeenCalledWith(
          expect.any(FormData)
        )
      })
    })

    it('should reject invalid file types', async () => {
      const user = userEvent.setup()
      
      render(<DocumentUploader />)
      
      const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' })
      const input = screen.getByLabelText(/upload/i)
      
      await user.upload(input, file)
      
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument()
      expect(mockedService.uploadDocument).not.toHaveBeenCalled()
    })

    it('should show upload progress', async () => {
      const user = userEvent.setup()
      
      // Mock upload with progress
      // Mock 带有进度的上传
      mockedService.uploadDocument.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ id: 'doc-1' }), 100)
        })
      })
      
      render(<DocumentUploader />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      await user.upload(screen.getByLabelText(/upload/i), file)
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle upload failure', async () => {
      const user = userEvent.setup()
      mockedService.uploadDocument.mockRejectedValue(new Error('Upload failed'))
      
      render(<DocumentUploader />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      await user.upload(screen.getByLabelText(/upload/i), file)
      
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument()
      })
    })

    it('should allow retry after failure', async () => {
      const user = userEvent.setup()
      mockedService.uploadDocument
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'doc-1' })
      
      render(<DocumentUploader />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      await user.upload(screen.getByLabelText(/upload/i), file)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /retry/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument()
      })
    })
  })
})
```

### 示例：带分页的文档列表

```typescript
describe('DocumentList', () => {
  describe('Pagination', () => {
    it('should load first page on mount', async () => {
      mockedService.getDocuments.mockResolvedValue({
        data: [{ id: '1', name: 'Doc 1' }],
        total: 50,
        page: 1,
        pageSize: 10,
      })
      
      render(<DocumentList datasetId="ds-1" />)
      
      await waitFor(() => {
        expect(screen.getByText('Doc 1')).toBeInTheDocument()
      })
      
      expect(mockedService.getDocuments).toHaveBeenCalledWith('ds-1', { page: 1 })
    })

    it('should navigate to next page', async () => {
      const user = userEvent.setup()
      mockedService.getDocuments.mockResolvedValue({
        data: [{ id: '1', name: 'Doc 1' }],
        total: 50,
        page: 1,
        pageSize: 10,
      })
      
      render(<DocumentList datasetId="ds-1" />)
      
      await waitFor(() => {
        expect(screen.getByText('Doc 1')).toBeInTheDocument()
      })
      
      mockedService.getDocuments.mockResolvedValue({
        data: [{ id: '11', name: 'Doc 11' }],
        total: 50,
        page: 2,
        pageSize: 10,
      })
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Doc 11')).toBeInTheDocument()
      })
    })
  })

  describe('Search & Filtering', () => {
    it('should filter by search query', async () => {
      const user = userEvent.setup()
      vi.useFakeTimers()
      
      render(<DocumentList datasetId="ds-1" />)
      
      await user.type(screen.getByPlaceholderText(/search/i), 'test query')
      
      // Debounce
      vi.advanceTimersByTime(300)
      
      await waitFor(() => {
        expect(mockedService.getDocuments).toHaveBeenCalledWith(
          'ds-1',
          expect.objectContaining({ search: 'test query' })
        )
      })
      
      vi.useRealTimers()
    })
  })
})
```

## 配置组件 (`app/configuration/`, `config/`)

配置组件处理表单、验证和数据持久化。

### 关键测试领域

1. **表单验证**
1. **保存/重置**
1. **必需与可选字段**
1. **配置持久化**
1. **错误反馈**

### 示例：应用配置表单

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppConfigForm from './app-config-form'

vi.mock('@/service/apps', () => ({
  updateAppConfig: vi.fn(),
  getAppConfig: vi.fn(),
}))

import * as appService from '@/service/apps'
const mockedService = vi.mocked(appService)

describe('AppConfigForm', () => {
  const defaultConfig = {
    name: 'My App',
    description: '',
    icon: 'default',
    openingStatement: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedService.getAppConfig.mockResolvedValue(defaultConfig)
  })

  describe('Form Validation', () => {
    it('should require app name', async () => {
      const user = userEvent.setup()
      
      render(<AppConfigForm appId="app-1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toHaveValue('My App')
      })
      
      // Clear name field
      // 清除名称字段
      await user.clear(screen.getByLabelText(/name/i))
      await user.click(screen.getByRole('button', { name: /save/i }))
      
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      expect(mockedService.updateAppConfig).not.toHaveBeenCalled()
    })

    it('should validate name length', async () => {
      const user = userEvent.setup()
      
      render(<AppConfigForm appId="app-1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      })
      
      // Enter very long name
      // 输入非常长的名称
      await user.clear(screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'a'.repeat(101))
      
      expect(screen.getByText(/name must be less than 100 characters/i)).toBeInTheDocument()
    })

    it('should allow empty optional fields', async () => {
      const user = userEvent.setup()
      mockedService.updateAppConfig.mockResolvedValue({ success: true })
      
      render(<AppConfigForm appId="app-1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toHaveValue('My App')
      })
      
      // Leave description empty (optional)
      // 将描述留空（可选）
      await user.click(screen.getByRole('button', { name: /save/i }))
      
      await waitFor(() => {
        expect(mockedService.updateAppConfig).toHaveBeenCalled()
      })
    })
  })

  describe('Save/Reset Functionality', () => {
    it('should save configuration', async () => {
      const user = userEvent.setup()
      mockedService.updateAppConfig.mockResolvedValue({ success: true })
      
      render(<AppConfigForm appId="app-1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toHaveValue('My App')
      })
      
      await user.clear(screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'Updated App')
      await user.click(screen.getByRole('button', { name: /save/i }))
      
      await waitFor(() => {
        expect(mockedService.updateAppConfig).toHaveBeenCalledWith(
          'app-1',
          expect.objectContaining({ name: 'Updated App' })
        )
      })
      
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument()
    })

    it('should reset to default values', async () => {
      const user = userEvent.setup()
      
      render(<AppConfigForm appId="app-1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toHaveValue('My App')
      })
      
      // Make changes
      // 做出更改
      await user.clear(screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'Changed Name')
      
      // Reset
      // 重置
      await user.click(screen.getByRole('button', { name: /reset/i }))
      
      expect(screen.getByLabelText(/name/i)).toHaveValue('My App')
    })

    it('should show unsaved changes warning', async () => {
      const user = userEvent.setup()
      
      render(<AppConfigForm appId="app-1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toHaveValue('My App')
      })
      
      // Make changes
      // 做出更改
      await user.type(screen.getByLabelText(/name/i), ' Updated')
      
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should show error on save failure', async () => {
      const user = userEvent.setup()
      mockedService.updateAppConfig.mockRejectedValue(new Error('Server error'))
      
      render(<AppConfigForm appId="app-1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toHaveValue('My App')
      })
      
      await user.click(screen.getByRole('button', { name: /save/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
      })
    })
  })
})
```
