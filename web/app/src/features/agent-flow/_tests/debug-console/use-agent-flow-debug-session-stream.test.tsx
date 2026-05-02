import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createDefaultAgentFlowDocument } from '@1flowbase/flow-schema';

import * as runtimeApi from '../../api/runtime';
import { useAgentFlowDebugSession } from '../../hooks/runtime/useAgentFlowDebugSession';
import { resetAuthStore, useAuthStore } from '../../../../state/auth-store';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  window.localStorage.clear();
  resetAuthStore();
  useAuthStore.getState().setAuthenticated({
    csrfToken: 'csrf-123',
    actor: {
      id: 'user-1',
      account: 'root',
      effective_display_role: 'root',
      current_workspace_id: 'workspace-1'
    },
    me: {
      id: 'user-1',
      account: 'root',
      email: 'root@example.com',
      phone: null,
      nickname: 'Root',
      name: 'Root',
      avatar_url: null,
      introduction: '',
      effective_display_role: 'root',
      permissions: ['application.view.all', 'application.edit.own']
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAgentFlowDebugSession streaming', () => {
  test('handles flow accepted and batches text deltas without rebuilding variable cache per token', async () => {
    vi.useFakeTimers();

    try {
      const queryClient = createQueryClient();
      const requestAnimationFrameSpy = vi.spyOn(
        window,
        'requestAnimationFrame'
      );
      const startFlowDebugRunStreamSpy = vi
        .spyOn(runtimeApi, 'startFlowDebugRunStream')
        .mockImplementation(
          async (_applicationId, _input, _csrfToken, handlers) => {
            handlers.onEvent({
              type: 'flow_accepted',
              run_id: 'run-1',
              status: 'queued'
            });
            handlers.onEvent({
              type: 'flow_started',
              run_id: 'run-1',
              status: 'running'
            });
            handlers.onEvent({
              type: 'text_delta',
              node_id: 'node-llm',
              text: '退'
            });
            handlers.onEvent({
              type: 'text_delta',
              node_id: 'node-llm',
              text: '款'
            });
            handlers.onEvent({
              type: 'flow_finished',
              run_id: 'run-1',
              status: 'succeeded',
              output: { answer: '退款' }
            });
          }
        );
      const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
      const { result } = renderHook(
        () =>
          useAgentFlowDebugSession({
            applicationId: 'app-1',
            draftId: 'draft-1',
            document
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        const promise = result.current.submitPrompt('退款');
        await vi.runOnlyPendingTimersAsync();
        await promise;
      });

      expect(startFlowDebugRunStreamSpy).toHaveBeenCalled();
      expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
      expect(result.current.messages.at(-1)).toEqual(
        expect.objectContaining({
          runId: 'run-1',
          status: 'completed',
          content: '退款'
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test('streams reasoning deltas into assistant thought content before answer text', async () => {
    vi.useFakeTimers();

    try {
      const queryClient = createQueryClient();
      vi.spyOn(runtimeApi, 'startFlowDebugRunStream').mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'run-reasoning',
            status: 'running'
          });
          handlers.onEvent({
            type: 'reasoning_delta',
            node_id: 'node-llm',
            text: '先分析'
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: '结果'
          });
        }
      );
      const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
      const { result } = renderHook(
        () =>
          useAgentFlowDebugSession({
            applicationId: 'app-1',
            draftId: 'draft-1',
            document
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.submitPrompt('请分析退款政策');
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.messages.at(-1)).toEqual(
        expect.objectContaining({
          runId: 'run-reasoning',
          status: 'running',
          reasoningContent: '先分析',
          content: '结果'
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test('keeps stream error state when a pending text delta flush exists', async () => {
    vi.useFakeTimers();

    try {
      const queryClient = createQueryClient();
      vi.spyOn(runtimeApi, 'startFlowDebugRunStream').mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'flow-run-stream',
            status: 'running'
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: 'partial answer'
          });
          throw new Error('stream down');
        }
      );
      const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
      const { result } = renderHook(
        () =>
          useAgentFlowDebugSession({
            applicationId: 'app-1',
            draftId: 'draft-1',
            document
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.submitPrompt('请总结退款政策');
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.status).toBe('failed');
      expect(result.current.messages.at(-1)).toEqual(
        expect.objectContaining({
          role: 'assistant',
          runId: 'flow-run-stream',
          status: 'failed',
          content: 'stream down'
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test('keeps newer trace summary when a node event follows a pending text delta', async () => {
    vi.useFakeTimers();

    try {
      const queryClient = createQueryClient();
      vi.spyOn(runtimeApi, 'startFlowDebugRunStream').mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'flow-run-stream',
            status: 'running'
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: 'partial answer'
          });
          handlers.onEvent({
            type: 'node_started',
            node_run_id: 'node-run-llm',
            node_id: 'node-llm',
            node_type: 'llm',
            title: 'LLM',
            input_payload: {}
          });
        }
      );
      const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
      const { result } = renderHook(
        () =>
          useAgentFlowDebugSession({
            applicationId: 'app-1',
            draftId: 'draft-1',
            document
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.submitPrompt('请总结退款政策');
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.messages.at(-1)).toEqual(
        expect.objectContaining({
          content: 'partial answer',
          traceSummary: [
            expect.objectContaining({
              nodeId: 'node-llm',
              nodeAlias: 'LLM',
              status: 'running'
            })
          ]
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test('does not restore a pending text delta after clearing the session', async () => {
    vi.useFakeTimers();

    try {
      const queryClient = createQueryClient();
      vi.spyOn(runtimeApi, 'startFlowDebugRunStream').mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'flow-run-stream',
            status: 'running'
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: 'partial answer'
          });
        }
      );
      const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
      const { result } = renderHook(
        () =>
          useAgentFlowDebugSession({
            applicationId: 'app-1',
            draftId: 'draft-1',
            document
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.submitPrompt('请总结退款政策');
        result.current.clearSession();
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.messages).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  test('aborts and ignores active stream events after clearing the session', async () => {
    const queryClient = createQueryClient();
    const abortController = new AbortController();
    const abortSpy = vi.spyOn(abortController, 'abort');
    let handlers: runtimeApi.FlowDebugRunStreamHandlers | null = null;
    let resolveStream: (() => void) | null = null;
    const streamSettled = new Promise<void>((resolve) => {
      resolveStream = resolve;
    });

    vi.spyOn(runtimeApi, 'startFlowDebugRunStream').mockImplementation(
      async (_applicationId, _input, _csrfToken, nextHandlers) => {
        handlers = nextHandlers;
        nextHandlers.getAbortController?.(abortController);
        await streamSettled;
      }
    );
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
    const { result } = renderHook(
      () =>
        useAgentFlowDebugSession({
          applicationId: 'app-1',
          draftId: 'draft-1',
          document
        }),
      { wrapper: createWrapper(queryClient) }
    );

    let submitPromise: Promise<unknown> | null = null;
    await act(async () => {
      submitPromise = result.current.submitPrompt('请总结退款政策');
      await Promise.resolve();
    });

    await act(async () => {
      result.current.clearSession();
    });

    expect(abortSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      handlers?.onEvent({
        type: 'flow_started',
        run_id: 'flow-run-stale',
        status: 'running'
      });
      resolveStream?.();
      await submitPromise;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.messages).toEqual([]);
  });

  test('does not return to running when resetting variables with a pending text delta', async () => {
    vi.useFakeTimers();

    try {
      const queryClient = createQueryClient();
      vi.spyOn(runtimeApi, 'startFlowDebugRunStream').mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'flow-run-stream',
            status: 'running'
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: 'partial answer'
          });
        }
      );
      const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
      const { result } = renderHook(
        () =>
          useAgentFlowDebugSession({
            applicationId: 'app-1',
            draftId: 'draft-1',
            document
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.submitPrompt('请总结退款政策');
        result.current.resetVariableCache();
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.status).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  test('aborts and ignores active stream events after resetting variables', async () => {
    const queryClient = createQueryClient();
    const abortController = new AbortController();
    const abortSpy = vi.spyOn(abortController, 'abort');
    let handlers: runtimeApi.FlowDebugRunStreamHandlers | null = null;
    let resolveStream: (() => void) | null = null;
    const streamSettled = new Promise<void>((resolve) => {
      resolveStream = resolve;
    });

    vi.spyOn(runtimeApi, 'startFlowDebugRunStream').mockImplementation(
      async (_applicationId, _input, _csrfToken, nextHandlers) => {
        handlers = nextHandlers;
        nextHandlers.getAbortController?.(abortController);
        await streamSettled;
      }
    );
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
    const { result } = renderHook(
      () =>
        useAgentFlowDebugSession({
          applicationId: 'app-1',
          draftId: 'draft-1',
          document
        }),
      { wrapper: createWrapper(queryClient) }
    );

    let submitPromise: Promise<unknown> | null = null;
    await act(async () => {
      submitPromise = result.current.submitPrompt('请总结退款政策');
      await Promise.resolve();
    });

    await act(async () => {
      result.current.resetVariableCache();
    });

    expect(abortSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      handlers?.onEvent({
        type: 'node_started',
        node_run_id: 'node-run-stale',
        node_id: 'node-llm',
        node_type: 'llm',
        title: 'LLM',
        input_payload: {}
      });
      resolveStream?.();
      await submitPromise;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.traceItems).toEqual([]);
  });

  test('submits even when crypto.randomUUID is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined
    });
    const queryClient = createQueryClient();
    const startFlowDebugRunStreamSpy = vi
      .spyOn(runtimeApi, 'startFlowDebugRunStream')
      .mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'flow-run-stream',
            status: 'running'
          });
          handlers.onEvent({
            type: 'flow_finished',
            run_id: 'flow-run-stream',
            status: 'succeeded',
            output: { answer: '你好' }
          });
        }
      );
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    try {
      const { result } = renderHook(
        () =>
          useAgentFlowDebugSession({
            applicationId: 'app-1',
            draftId: 'draft-1',
            document
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.submitPrompt('你好？');
      });

      expect(startFlowDebugRunStreamSpy).toHaveBeenCalled();
      expect(result.current.messages[0]).toEqual(
        expect.objectContaining({
          role: 'user',
          content: '你好？'
        })
      );
      expect(
        result.current.runContext.fields.find((field) => field.key === 'query')
          ?.value
      ).toBe('');
      expect(result.current.messages.at(-1)).toEqual(
        expect.objectContaining({
          role: 'assistant',
          content: '你好',
          status: 'completed'
        })
      );
    } finally {
      if (descriptor) {
        Object.defineProperty(crypto, 'randomUUID', descriptor);
      }
    }
  });

  test('streams debug run events into assistant content and trace state', async () => {
    const queryClient = createQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const startFlowDebugRunStreamSpy = vi
      .spyOn(runtimeApi, 'startFlowDebugRunStream')
      .mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'flow-run-stream',
            status: 'running'
          });
          handlers.onEvent({
            type: 'node_started',
            node_run_id: 'node-run-start',
            node_id: 'node-start',
            node_type: 'start',
            title: 'Start',
            input_payload: {}
          });
          handlers.onEvent({
            type: 'node_finished',
            node_run_id: 'node-run-start',
            node_id: 'node-start',
            status: 'succeeded',
            output_payload: { query: '请总结退款政策' },
            error_payload: null,
            metrics_payload: {},
            started_at: '2026-04-25T10:00:00Z',
            finished_at: '2026-04-25T10:00:00Z'
          });
          handlers.onEvent({
            type: 'node_started',
            node_run_id: 'node-run-llm',
            node_id: 'node-llm',
            node_type: 'llm',
            title: 'LLM',
            input_payload: { user_prompt: '请总结退款政策' }
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: '退款'
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: '政策摘要'
          });
          handlers.onEvent({
            type: 'node_finished',
            node_run_id: 'node-run-llm',
            node_id: 'node-llm',
            status: 'succeeded',
            output_payload: { text: '退款政策摘要' },
            error_payload: null,
            metrics_payload: { total_tokens: 128 },
            started_at: '2026-04-25T10:00:01Z',
            finished_at: '2026-04-25T10:00:02Z'
          });
          handlers.onEvent({
            type: 'flow_finished',
            run_id: 'flow-run-stream',
            status: 'succeeded',
            output: { answer: '退款政策摘要' }
          });
          handlers.onCompleted?.();
        }
      );
    const startFlowDebugRunSpy = vi.spyOn(runtimeApi, 'startFlowDebugRun');
    const fetchApplicationRunDetailSpy = vi.spyOn(
      runtimeApi,
      'fetchApplicationRunDetail'
    );
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    const { result } = renderHook(
      () =>
        useAgentFlowDebugSession({
          applicationId: 'app-1',
          draftId: 'draft-1',
          document
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.submitPrompt('请总结退款政策');
    });

    expect(startFlowDebugRunStreamSpy).toHaveBeenCalledWith(
      'app-1',
      {
        document,
        input_payload: {
          'node-start': { files: undefined, query: '请总结退款政策' }
        }
      },
      'csrf-123',
      expect.objectContaining({
        onEvent: expect.any(Function)
      })
    );
    expect(startFlowDebugRunSpy).not.toHaveBeenCalled();
    expect(fetchApplicationRunDetailSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('completed');
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: 'assistant',
        runId: 'flow-run-stream',
        status: 'completed',
        content: '退款政策摘要'
      })
    );
    expect(result.current.traceItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'node-llm',
          nodeAlias: 'LLM',
          status: 'succeeded'
        })
      ])
    );
    expect(result.current.getNodePreviewVariableCache()).toEqual(
      expect.objectContaining({
        'node-start': expect.objectContaining({
          query: '请总结退款政策'
        }),
        'node-llm': expect.objectContaining({
          text: '退款政策摘要'
        })
      })
    );
    expect(
      runtimeApi.buildNodeDebugPreviewPlan(
        document,
        'node-answer',
        result.current.getNodePreviewVariableCache()
      )
    ).toEqual({
      input_payload: {
        'node-llm': {
          text: '退款政策摘要'
        }
      },
      missing_fields: []
    });

    await act(async () => {
      await result.current.submitPrompt();
    });

    expect(startFlowDebugRunStreamSpy).toHaveBeenLastCalledWith(
      'app-1',
      {
        document,
        input_payload: {
          'node-start': { files: undefined, query: '' }
        }
      },
      'csrf-123',
      expect.objectContaining({
        onEvent: expect.any(Function)
      })
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['applications', 'app-1', 'runtime']
    });
  });

  test('marks streamed debug run cancelled after flow cancelled event', async () => {
    const queryClient = createQueryClient();
    const startFlowDebugRunStreamSpy = vi
      .spyOn(runtimeApi, 'startFlowDebugRunStream')
      .mockImplementation(
        async (_applicationId, _input, _csrfToken, handlers) => {
          handlers.onEvent({
            type: 'flow_started',
            run_id: 'flow-run-stream',
            status: 'running'
          });
          handlers.onEvent({
            type: 'text_delta',
            node_id: 'node-llm',
            text: 'partial answer'
          });
          handlers.onEvent({
            type: 'flow_cancelled',
            run_id: 'flow-run-stream',
            status: 'cancelled'
          });
          handlers.onCompleted?.();
        }
      );
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    const { result } = renderHook(
      () =>
        useAgentFlowDebugSession({
          applicationId: 'app-1',
          draftId: 'draft-1',
          document
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.submitPrompt('请总结退款政策');
    });

    expect(startFlowDebugRunStreamSpy).toHaveBeenCalled();
    expect(result.current.status).toBe('cancelled');
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: 'assistant',
        runId: 'flow-run-stream',
        status: 'cancelled',
        content: 'partial answer'
      })
    );
  });
});
