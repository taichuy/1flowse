import { useAgentFlowEditorStore } from '../../store/editor/provider';

export function useSelectionInteractions() {
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);
  const setPanelState = useAgentFlowEditorStore((state) => state.setPanelState);

  return {
    clearSelection() {
      setSelection({
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedNodeIds: []
      });
      setPanelState({
        nodePickerState: {
          open: false,
          anchorNodeId: null,
          anchorEdgeId: null
        }
      });
    }
  };
}
