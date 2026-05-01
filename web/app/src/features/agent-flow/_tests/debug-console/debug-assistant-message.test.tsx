import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { DebugAssistantMessage } from '../../components/debug-console/conversation/DebugAssistantMessage';
import type { AgentFlowDebugMessage } from '../../api/runtime';

describe('DebugAssistantMessage', () => {
  test('renders streamed answer content as markdown and shows the current workflow node', () => {
    const message: AgentFlowDebugMessage = {
      id: 'assistant-1',
      role: 'assistant',
      status: 'running',
      runId: 'run-1',
      content: [
        '## 处理结果',
        '',
        '| 项目 | 状态 |',
        '| --- | --- |',
        '| 退款 | 已确认 |'
      ].join('\n'),
      rawOutput: null,
      traceSummary: [
        {
          nodeId: 'node-start',
          nodeAlias: 'Start',
          nodeType: 'start',
          status: 'succeeded',
          startedAt: '2026-04-25T10:00:00Z',
          finishedAt: '2026-04-25T10:00:00Z',
          durationMs: 0,
          inputPayload: {},
          outputPayload: { query: '退款' },
          errorPayload: null,
          metricsPayload: {}
        },
        {
          nodeId: 'node-llm',
          nodeAlias: 'LLM',
          nodeType: 'llm',
          status: 'running',
          startedAt: '2026-04-25T10:00:01Z',
          finishedAt: null,
          durationMs: null,
          inputPayload: { user_prompt: '退款' },
          outputPayload: {},
          errorPayload: null,
          metricsPayload: {}
        }
      ]
    };

    render(
      <DebugAssistantMessage
        message={message}
        onViewTrace={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '处理结果' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('退款')).toBeInTheDocument();
    expect(within(table).getByText('已确认')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '工作流' })).toBeInTheDocument();
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
    expect(screen.getAllByText('LLM').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'llm 节点类型' })).toBeInTheDocument();

    const workflowToggle = screen.getByRole('button', { name: /工作流/ });
    expect(workflowToggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(workflowToggle);

    expect(workflowToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /LLM/ })).not.toBeInTheDocument();

    fireEvent.click(workflowToggle);

    expect(workflowToggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /LLM/ }));

    expect(screen.getByText('输入')).toBeInTheDocument();
    expect(screen.getByText('输出')).toBeInTheDocument();
    expect(screen.getByText(/user_prompt/)).toBeInTheDocument();
  });


  test('reveals newly arrived assistant content progressively', () => {
    vi.useFakeTimers();
    const baseMessage: AgentFlowDebugMessage = {
      id: 'assistant-typing',
      role: 'assistant',
      status: 'running',
      runId: 'run-1',
      content: '',
      rawOutput: null,
      traceSummary: []
    };

    const { container, rerender } = render(
      <DebugAssistantMessage
        message={baseMessage}
        onViewTrace={vi.fn()}
      />
    );

    rerender(
      <DebugAssistantMessage
        message={{ ...baseMessage, content: 'abcdef' }}
        onViewTrace={vi.fn()}
      />
    );

    expect(container).not.toHaveTextContent('abcdef');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container).toHaveTextContent('abcdef');
    vi.useRealTimers();
  });

});
