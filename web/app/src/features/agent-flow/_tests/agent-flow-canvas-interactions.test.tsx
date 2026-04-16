import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createDefaultAgentFlowDocument,
  type FlowNodeType
} from '@1flowse/flow-schema';
import { AgentFlowCanvas } from '../components/editor/AgentFlowCanvas';
import {
  AgentFlowEditorStoreProvider,
  useAgentFlowEditorStore
} from '../store/editor/provider';
import { selectWorkingDocument } from '../store/editor/selectors';

type MockNodeChange = {
  id: string;
  type: string;
  dragging?: boolean;
  position?: { x: number; y: number };
};

type MockViewport = {
  x: number;
  y: number;
  zoom: number;
};

type MockReactFlowProps = {
  children?: ReactNode;
  edges?: Array<{
    id: string;
    data?: {
      onInsertNode?: (edgeId: string, nodeType: FlowNodeType) => void;
    };
  }>;
  onPaneClick?: () => void;
  onNodesChange?: (changes: MockNodeChange[]) => void;
  onReconnect?: (
    oldEdge: {
      id: string;
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    },
    connection: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }
  ) => void;
  onViewportChange?: (viewport: MockViewport) => void;
  viewport?: MockViewport;
};

let latestReactFlowProps: MockReactFlowProps | null = null;
let mockViewport: MockViewport = { x: 0, y: 0, zoom: 1 };

function createInitialState(document = createDefaultAgentFlowDocument({ flowId: 'flow-1' })) {
  return {
    flow_id: 'flow-1',
    draft: {
      id: 'draft-1',
      flow_id: 'flow-1',
      updated_at: '2026-04-16T10:00:00Z',
      document
    },
    autosave_interval_seconds: 30,
    versions: []
  };
}

type ObservedEditorState = {
  selectedNodeId: string | null;
  workingDocument: ReturnType<typeof createDefaultAgentFlowDocument>;
};

function StoreObserver({
  onChange
}: {
  onChange: (state: ObservedEditorState) => void;
}) {
  const workingDocument = useAgentFlowEditorStore(selectWorkingDocument);
  const selectedNodeId = useAgentFlowEditorStore((state) => state.selectedNodeId);

  useEffect(() => {
    onChange({
      selectedNodeId,
      workingDocument
    });
  }, [onChange, selectedNodeId, workingDocument]);

  return null;
}

function renderCanvas(
  document = createDefaultAgentFlowDocument({ flowId: 'flow-1' })
) {
  let latestState: ObservedEditorState | null = null;

  render(
    <AgentFlowEditorStoreProvider initialState={createInitialState(document)}>
      <StoreObserver
        onChange={(state) => {
          latestState = state;
        }}
      />
      <AgentFlowCanvas issueCountByNodeId={{}} />
    </AgentFlowEditorStoreProvider>
  );

  return {
    getState() {
      if (!latestState) {
        throw new Error('editor state not observed');
      }

      return latestState;
    }
  };
}

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Controls: () => null,
  EdgeLabelRenderer: ({ children }: { children?: ReactNode }) => children ?? null,
  Handle: () => null,
  MarkerType: {
    ArrowClosed: 'arrowclosed'
  },
  Panel: ({ children }: { children?: ReactNode }) => children ?? null,
  Position: {
    Left: 'left',
    Right: 'right'
  },
  ReactFlow: (props: MockReactFlowProps) => {
    latestReactFlowProps = props;
    mockViewport = props.viewport ?? mockViewport;

    return (
      <div data-testid="mock-react-flow">
        <button
          type="button"
          onClick={() =>
            props.onNodesChange?.([
              {
                id: 'node-llm',
                type: 'position',
                dragging: false,
                position: { x: 520, y: 260 }
              }
            ])
          }
        >
          trigger node drag
        </button>
        <button
          type="button"
          onClick={() => {
            mockViewport = { x: 120, y: 48, zoom: 0.85 };
            props.onViewportChange?.(mockViewport);
          }}
        >
          trigger viewport change
        </button>
        {props.children}
      </div>
    );
  },
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => children ?? null,
  getBezierPath: () => ['M0,0', 0, 0],
  useReactFlow: () => ({
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn()
  }),
  useViewport: () => mockViewport
}));

describe('AgentFlowCanvas interactions', () => {
  beforeEach(() => {
    latestReactFlowProps = null;
    mockViewport = { x: 0, y: 0, zoom: 1 };
  });

  test('writes dragged node positions back into the document', () => {
    const { getState } = renderCanvas();

    fireEvent.click(screen.getByRole('button', { name: 'trigger node drag' }));

    expect(getState().workingDocument.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'node-llm',
          position: { x: 520, y: 260 }
        })
      ])
    );
  });

  test('opens with the document viewport and shows a plain percentage label', () => {
    renderCanvas();

    expect(latestReactFlowProps?.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(screen.getByLabelText('当前缩放')).toHaveTextContent('100%');
  });

  test('writes viewport changes back into the document', () => {
    const { getState } = renderCanvas();

    fireEvent.click(screen.getByRole('button', { name: 'trigger viewport change' }));

    expect(getState().workingDocument.editor.viewport).toEqual({
      x: 120,
      y: 48,
      zoom: 0.85
    });
  });

  test('inserts a node through the edge action callback', () => {
    const { getState } = renderCanvas();

    expect(latestReactFlowProps).not.toBeNull();
    const insertOnEdge = latestReactFlowProps?.edges
      ?.find((edge) => edge.id === 'edge-llm-answer')
      ?.data?.onInsertNode;

    expect(insertOnEdge).toBeTypeOf('function');

    act(() => {
      insertOnEdge?.('edge-llm-answer', 'template_transform');
    });

    expect(getState().workingDocument.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'template_transform'
        })
      ])
    );
    expect(getState().selectedNodeId).toMatch(/^node-template-transform-/);
  });

  test('rewrites the document edge when an existing line is reconnected', () => {
    const { getState } = renderCanvas();

    expect(latestReactFlowProps?.onReconnect).toBeTypeOf('function');

    act(() => {
      latestReactFlowProps?.onReconnect?.(
        {
          id: 'edge-start-llm',
          source: 'node-start',
          target: 'node-llm',
          sourceHandle: null,
          targetHandle: null
        },
        {
          source: 'node-start',
          target: 'node-answer',
          sourceHandle: 'source-right',
          targetHandle: 'target-left'
        }
      );
    });

    expect(getState().workingDocument.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'edge-start-llm',
          source: 'node-start',
          target: 'node-answer',
          sourceHandle: 'source-right',
          targetHandle: 'target-left'
        })
      ])
    );
  });

  test('clears node selection when clicking the pane', () => {
    const { getState } = renderCanvas();

    expect(getState().selectedNodeId).toBe('node-llm');
    expect(latestReactFlowProps?.onPaneClick).toBeTypeOf('function');

    act(() => {
      latestReactFlowProps?.onPaneClick?.();
    });

    expect(getState().selectedNodeId).toBe(null);
  });
});
