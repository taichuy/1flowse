import type { NodeChange } from '@xyflow/react';

import { moveNodes } from '../../lib/document/transforms/node';
import { setViewport } from '../../lib/document/transforms/viewport';
import { useAgentFlowEditorStore } from '../../store/editor/provider';
import { selectWorkingDocument } from '../../store/editor/selectors';

export function useCanvasInteractions() {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const setWorkingDocument = useAgentFlowEditorStore(
    (state) => state.setWorkingDocument
  );

  return {
    onNodesChange(changes: NodeChange[]) {
      const positions = Object.fromEntries(
        changes
          .filter(
            (
              change
            ): change is NodeChange & {
              id: string;
              position: { x: number; y: number };
            } =>
              change.type === 'position' &&
              'id' in change &&
              'position' in change &&
              Boolean(change.position)
          )
          .map((change) => [change.id, change.position])
      );

      if (Object.keys(positions).length === 0) {
        return;
      }

      setWorkingDocument(moveNodes(document, positions));
    },
    onViewportChange(viewport: { x: number; y: number; zoom: number }) {
      setWorkingDocument(
        setViewport(document, {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom
        })
      );
    }
  };
}
