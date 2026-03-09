/**
 * 自定义 Hook 的测试模板
 *
 * 说明：
 * 1. 将 `useHookName` 替换为您的 Hook 名称
 * 2. 更新导入路径
 * 3. 根据 Hook 功能添加/删除测试部分
 */

import { renderHook, act, waitFor } from '@testing-library/react'
// import { useHookName } from './use-hook-name'

// ============================================================================
// Mocks
// ============================================================================

// API 服务 (如果 Hook 获取数据)
// vi.mock('@/service/api')
// import * as api from '@/service/api'
// const mockedApi = vi.mocked(api)

// ============================================================================
// 测试辅助函数
// ============================================================================

// 需要上下文的 Hook 的包装器
// const createWrapper = (contextValue = {}) => {
//   return ({ children }: { children: React.ReactNode }) => (
//     <SomeContext.Provider value={contextValue}>
//       {children}
//     </SomeContext.Provider>
//   )
// }

// ============================================================================
// 测试
// ============================================================================

describe('useHookName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // 初始状态
  // --------------------------------------------------------------------------
  describe('Initial State', () => {
    it('should return initial state', () => {
      // const { result } = renderHook(() => useHookName())
      //
      // expect(result.current.value).toBe(initialValue)
      // expect(result.current.isLoading).toBe(false)
    })

    it('should accept initial value from props', () => {
      // const { result } = renderHook(() => useHookName({ initialValue: 'custom' }))
      //
      // expect(result.current.value).toBe('custom')
    })
  })

  // --------------------------------------------------------------------------
  // 状态更新
  // --------------------------------------------------------------------------
  describe('State Updates', () => {
    it('should update value when setValue is called', () => {
      // const { result } = renderHook(() => useHookName())
      //
      // act(() => {
      //   result.current.setValue('new value')
      // })
      //
      // expect(result.current.value).toBe('new value')
    })

    it('should reset to initial value', () => {
      // const { result } = renderHook(() => useHookName({ initialValue: 'initial' }))
      //
      // act(() => {
      //   result.current.setValue('changed')
      // })
      // expect(result.current.value).toBe('changed')
      //
      // act(() => {
      //   result.current.reset()
      // })
      // expect(result.current.value).toBe('initial')
    })
  })

  // --------------------------------------------------------------------------
  // 异步操作
  // --------------------------------------------------------------------------
  describe('Async Operations', () => {
    it('should fetch data on mount', async () => {
      // mockedApi.fetchData.mockResolvedValue({ data: 'test' })
      //
      // const { result } = renderHook(() => useHookName())
      //
      // // Initially loading
      // expect(result.current.isLoading).toBe(true)
      //
      // // Wait for data
      // await waitFor(() => {
      //   expect(result.current.isLoading).toBe(false)
      // })
      //
      // expect(result.current.data).toEqual({ data: 'test' })
    })

    it('should handle fetch error', async () => {
      // mockedApi.fetchData.mockRejectedValue(new Error('Network error'))
      //
      // const { result } = renderHook(() => useHookName())
      //
      // await waitFor(() => {
      //   expect(result.current.error).toBeTruthy()
      // })
      //
      // expect(result.current.error?.message).toBe('Network error')
    })

    it('should refetch when dependency changes', async () => {
      // mockedApi.fetchData.mockResolvedValue({ data: 'test' })
      //
      // const { result, rerender } = renderHook(
      //   ({ id }) => useHookName(id),
      //   { initialProps: { id: '1' } }
      // )
      //
      // await waitFor(() => {
      //   expect(mockedApi.fetchData).toHaveBeenCalledWith('1')
      // })
      //
      // rerender({ id: '2' })
      //
      // await waitFor(() => {
      //   expect(mockedApi.fetchData).toHaveBeenCalledWith('2')
      // })
    })
  })

  // --------------------------------------------------------------------------
  // 副作用
  // --------------------------------------------------------------------------
  describe('Side Effects', () => {
    it('should call callback when value changes', () => {
      // const callback = vi.fn()
      // const { result } = renderHook(() => useHookName({ onChange: callback }))
      //
      // act(() => {
      //   result.current.setValue('new value')
      // })
      //
      // expect(callback).toHaveBeenCalledWith('new value')
    })

    it('should cleanup on unmount', () => {
      // const cleanup = vi.fn()
      // vi.spyOn(window, 'addEventListener')
      // vi.spyOn(window, 'removeEventListener')
      //
      // const { unmount } = renderHook(() => useHookName())
      //
      // expect(window.addEventListener).toHaveBeenCalled()
      //
      // unmount()
      //
      // expect(window.removeEventListener).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // 边界情况
  // --------------------------------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle null input', () => {
      // const { result } = renderHook(() => useHookName(null))
      //
      // expect(result.current.value).toBeNull()
    })

    it('should handle rapid updates', () => {
      // const { result } = renderHook(() => useHookName())
      //
      // act(() => {
      //   result.current.setValue('1')
      //   result.current.setValue('2')
      //   result.current.setValue('3')
      // })
      //
      // expect(result.current.value).toBe('3')
    })
  })

  // --------------------------------------------------------------------------
  // 使用 Context (如果 Hook 使用上下文)
  // --------------------------------------------------------------------------
  describe('With Context', () => {
    it('should use context value', () => {
      // const wrapper = createWrapper({ someValue: 'context-value' })
      // const { result } = renderHook(() => useHookName(), { wrapper })
      //
      // expect(result.current.contextValue).toBe('context-value')
    })
  })
})
