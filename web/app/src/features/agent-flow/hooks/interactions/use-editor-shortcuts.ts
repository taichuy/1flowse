import { removeEdge } from '../../lib/document/transforms/edge';
import { useEffect } from 'react';

import { useNodeDetailActions } from './use-node-detail-actions';
import { useAgentFlowEditorStore } from '../../store/editor/provider';

export function useEditorShortcuts() {
  const workingDocument = useAgentFlowEditorStore((state) => state.workingDocument);
  const selectedNodeId = useAgentFlowEditorStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAgentFlowEditorStore((state) => state.selectedEdgeId);
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);
  const setWorkingDocument = useAgentFlowEditorStore(
    (state) => state.setWorkingDocument
  );
  const setInteractionState = useAgentFlowEditorStore(
    (state) => state.setInteractionState
  );
  const setPanelState = useAgentFlowEditorStore((state) => state.setPanelState);
  const detailActions = useNodeDetailActions();

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const isContentEditable = target.isContentEditable
        || target.getAttribute('contenteditable') === 'true';

      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        isContentEditable
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isEditableTarget(event.target)) {
          return;
        }

        event.preventDefault();

        if (selectedNodeId) {
          detailActions.deleteSelectedNode();
          return;
        }

        if (selectedEdgeId) {
          const nextDocument = removeEdge(workingDocument, {
            edgeId: selectedEdgeId
          });

          if (nextDocument !== workingDocument) {
            setWorkingDocument(nextDocument);
          }

          setSelection({
            selectedEdgeId: null
          });
        }

        return;
      }

      if (event.key !== 'Escape') {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      setSelection({
        selectedNodeId: null,
        selectedEdgeId: null,
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    detailActions,
    selectedNodeId,
    selectedEdgeId,
    setInteractionState,
    setPanelState,
    setSelection,
    setWorkingDocument,
    workingDocument
  ]);
}
