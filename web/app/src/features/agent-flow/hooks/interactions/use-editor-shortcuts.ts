import { removeEdge } from '../../lib/document/transforms/edge';
import { useEffect } from 'react';

import { useAgentFlowEditorStore } from '../../store/editor/provider';

export function useEditorShortcuts() {
  const workingDocument = useAgentFlowEditorStore((state) => state.workingDocument);
  const selectedEdgeId = useAgentFlowEditorStore((state) => state.selectedEdgeId);
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);
  const setWorkingDocument = useAgentFlowEditorStore(
    (state) => state.setWorkingDocument
  );
  const setInteractionState = useAgentFlowEditorStore(
    (state) => state.setInteractionState
  );
  const setPanelState = useAgentFlowEditorStore((state) => state.setPanelState);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeId) {
        if (isEditableTarget(event.target)) {
          return;
        }

        event.preventDefault();

        const nextDocument = removeEdge(workingDocument, {
          edgeId: selectedEdgeId
        });

        if (nextDocument !== workingDocument) {
          setWorkingDocument(nextDocument);
        }

        setSelection({
          selectedEdgeId: null
        });

        return;
      }

      if (event.key !== 'Escape') {
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
    selectedEdgeId,
    setInteractionState,
    setPanelState,
    setSelection,
    setWorkingDocument,
    workingDocument
  ]);
}
