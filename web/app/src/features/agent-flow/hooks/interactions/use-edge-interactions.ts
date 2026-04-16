import type { FlowNodeType } from '@1flowse/flow-schema';

import {
  createNextNodeId,
  createNodeDocument
} from '../../lib/document/node-factory';
import {
  insertNodeOnEdge,
  reconnectEdge,
  validateConnection
} from '../../lib/document/transforms/edge';
import { useAgentFlowEditorStore } from '../../store/editor/provider';
import { selectWorkingDocument } from '../../store/editor/selectors';

export function useEdgeInteractions() {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const setWorkingDocument = useAgentFlowEditorStore(
    (state) => state.setWorkingDocument
  );
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);

  return {
    reconnect(edgeId: string, connection: Parameters<typeof reconnectEdge>[1]['connection']) {
      const nextDocument = reconnectEdge(document, {
        edgeId,
        connection
      });

      if (nextDocument === document) {
        return;
      }

      setWorkingDocument(nextDocument);
      setSelection({
        selectedEdgeId: edgeId,
        selectedNodeId: null,
        selectedNodeIds: []
      });
    },
    insertOnEdge(edgeId: string, nodeType: FlowNodeType) {
      const nextNode = createNodeDocument(
        nodeType,
        createNextNodeId(document, nodeType)
      );
      const nextDocument = insertNodeOnEdge(document, {
        edgeId,
        node: nextNode
      });

      setWorkingDocument(nextDocument);
      setSelection({
        selectedNodeId: nextNode.id,
        selectedNodeIds: [nextNode.id],
        selectedEdgeId: null
      });
    },
    isValidConnection(
      connection: Parameters<typeof validateConnection>[1]
    ) {
      return validateConnection(document, connection);
    }
  };
}
