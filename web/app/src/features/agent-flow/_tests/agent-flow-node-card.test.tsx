import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { AgentFlowNodeCard } from '../components/nodes/AgentFlowNodeCard';

vi.mock('@xyflow/react', () => ({
  Handle: ({
    children,
    className,
    type
  }: {
    children?: React.ReactNode;
    className?: string;
    type: 'source' | 'target';
  }) => (
    <div className={className} data-testid={`${type}-handle`}>
      {children}
    </div>
  ),
  Position: {
    Left: 'left',
    Right: 'right'
  }
}));

vi.mock('../components/node-picker/NodePickerPopover', () => ({
  NodePickerPopover: ({ ariaLabel }: { ariaLabel: string }) => (
    <button type="button">{ariaLabel}</button>
  )
}));

function createProps({
  alias,
  description = '',
  canEnterContainer = false,
  nodeType,
  showSourceHandle = true,
  showTargetHandle
}: {
  alias: string;
  description?: string;
  canEnterContainer?: boolean;
  nodeType: 'start' | 'llm';
  showSourceHandle?: boolean;
  showTargetHandle: boolean;
}) {
  return {
    id: `canvas-${alias}`,
    selected: false,
    draggable: true,
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: true,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data: {
      alias,
      canEnterContainer,
      description,
      issueCount: 0,
      nodeId: `node-${alias.toLowerCase()}`,
      nodeType,
      onClosePicker: vi.fn(),
      onInsertNode: vi.fn(),
      onOpenContainer: vi.fn(),
      onOpenPicker: vi.fn(),
      onSelectNode: vi.fn(),
      pickerOpen: false,
      showSourceHandle,
      showTargetHandle,
      typeLabel: alias
    },
    type: 'agentFlowNode'
  } as unknown as Parameters<typeof AgentFlowNodeCard>[0];
}

describe('AgentFlowNodeCard', () => {
  test('does not render a target handle for the start node', () => {
    render(<AgentFlowNodeCard {...createProps({ alias: 'Start', nodeType: 'start', showTargetHandle: false })} />);

    expect(screen.queryByTestId('target-handle')).not.toBeInTheDocument();
    expect(screen.getByTestId('source-handle')).toBeInTheDocument();
  });

  test('renders the add-node trigger inside the source handle', () => {
    render(<AgentFlowNodeCard {...createProps({ alias: 'LLM', nodeType: 'llm', showTargetHandle: true })} />);

    const sourceHandle = screen.getByTestId('source-handle');

    expect(
      within(sourceHandle).getByRole('button', { name: '在 LLM 后新增节点' })
    ).toBeInTheDocument();
  });

  test('renders the node description when provided', () => {
    render(
      <AgentFlowNodeCard
        {...createProps({
          alias: 'Start',
          description: '收集用户输入并进入主链路。',
          nodeType: 'start',
          showTargetHandle: false
        })}
      />
    );

    expect(screen.getByText('收集用户输入并进入主链路。')).toBeInTheDocument();
  });
});
