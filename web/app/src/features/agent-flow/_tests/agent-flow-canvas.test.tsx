import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { createDefaultAgentFlowDocument } from '@1flowse/flow-schema';
import { AgentFlowEditorShell } from '../components/editor/AgentFlowEditorShell';

function createInitialState() {
  return {
    flow_id: 'flow-1',
    draft: {
      id: 'draft-1',
      flow_id: 'flow-1',
      updated_at: '2026-04-15T09:00:00Z',
      document: createDefaultAgentFlowDocument({ flowId: 'flow-1' })
    },
    versions: [],
    autosave_interval_seconds: 30
  };
}

describe('AgentFlowCanvas', () => {
  test('adds a node from the plus picker after the selected node', async () => {
    render(
      <div style={{ width: 1280, height: 720 }}>
        <AgentFlowEditorShell
          applicationId="app-1"
          applicationName="Support Agent"
          initialState={createInitialState()}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: '在 LLM 后新增节点' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Template Transform' })
    );

    expect(screen.getByText('Template Transform')).toBeInTheDocument();
  });
});
