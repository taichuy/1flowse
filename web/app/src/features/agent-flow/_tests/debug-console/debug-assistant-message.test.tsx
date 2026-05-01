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
          outputPayload: { text: '退款处理中' },
          errorPayload: { code: 'still_running' },
          metricsPayload: { total_tokens: 128 }
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
    const actionRow = screen.getByRole('group', { name: '输出动作' });
    expect(within(actionRow).getByRole('button', { name: /复制输出/ })).toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: /查看 Trace/ })).toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: /查看 Raw Output/ })).toBeInTheDocument();
    expect(
      table.compareDocumentPosition(actionRow) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByRole('group', { name: '工作流' })).toBeInTheDocument();
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
    expect(screen.getAllByText('LLM').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'llm 节点类型' })).toBeInTheDocument();

    const workflowToggle = screen.getByRole('button', { name: /工作流/ });
    expect(workflowToggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(workflowToggle).getByLabelText('running 状态')).toBeInTheDocument();
    expect(within(workflowToggle).queryByLabelText('succeeded 状态')).not.toBeInTheDocument();

    fireEvent.click(workflowToggle);

    expect(workflowToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /LLM/ })).not.toBeInTheDocument();

    fireEvent.click(workflowToggle);

    expect(workflowToggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /LLM/ }));

    const inputToggle = screen.getByRole('button', { name: '输入' });
    expect(inputToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('输出')).toBeInTheDocument();
    expect(screen.queryByText('错误')).not.toBeInTheDocument();
    expect(screen.queryByText('指标')).not.toBeInTheDocument();
    expect(screen.getByText(/user_prompt/)).toBeInTheDocument();
    const outputJson = screen.getByLabelText('输出 JSON');
    expect(outputJson).toHaveTextContent('退款处理中');
    expect(outputJson).toHaveTextContent('still_running');
    expect(outputJson).toHaveTextContent('total_tokens');

    fireEvent.click(inputToggle);

    expect(inputToggle).toHaveAttribute('aria-expanded', 'false');
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
