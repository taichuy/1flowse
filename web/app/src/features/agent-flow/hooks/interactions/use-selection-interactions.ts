import { useAgentFlowEditorStore } from '../../store/editor/provider';

export function useSelectionInteractions() {
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);
  const setInteractionState = useAgentFlowEditorStore(
    (state) => state.setInteractionState
  );
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
          anchorEdgeId: null,
          anchorCanvasPosition: null
        }
      });
      setInteractionState({
        connectingPayload: {
          sourceNodeId: null,
          sourceHandleId: null,
          sourceNodeType: null
        }
      });
    },
    selectEdge(edgeId: string) {
      setSelection({
        selectedEdgeId: edgeId,
        selectedNodeId: null,
        selectedNodeIds: [],
        focusedFieldKey: null,
        openInspectorSectionKey: null
      });
      setPanelState({
        nodePickerState: {
          open: false,
          anchorNodeId: null,
          anchorEdgeId: null,
          anchorCanvasPosition: null
        }
      });
      setInteractionState({
        connectingPayload: {
          sourceNodeId: null,
          sourceHandleId: null,
          sourceNodeType: null
        }
      });
    }
  };
}
