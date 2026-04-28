import { useEffect } from 'react';

import { useAgentFlowEditorStore } from '../features/agent-flow/store/editor/provider';

export function StyleBoundarySelectionSeed({ nodeId }: { nodeId: string }) {
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);

  useEffect(() => {
    setSelection({
      selectedNodeId: nodeId,
      selectedNodeIds: [nodeId]
    });
  }, [nodeId, setSelection]);

  return null;
}
