import { useMemo } from 'react';

import { createAgentFlowNodeSchemaAdapter } from '../../schema/node-schema-adapter';
import { resolveAgentFlowNodeSchema } from '../../schema/node-schema-registry';
import { useAgentFlowEditorStore } from '../../store/editor/provider';
import {
  selectSelectedNodeId,
  selectWorkingDocument
} from '../../store/editor/selectors';

export function useNodeSchemaRuntime(enabled = true) {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const selectedNodeId = useAgentFlowEditorStore(selectSelectedNodeId);
  const setWorkingDocument = useAgentFlowEditorStore(
    (state) => state.setWorkingDocument
  );
  const selectedNode = selectedNodeId
    ? document.graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const schema = useMemo(
    () =>
      enabled && selectedNode ? resolveAgentFlowNodeSchema(selectedNode.type) : null,
    [enabled, selectedNode]
  );
  const adapter = useMemo(
    () =>
      enabled && selectedNodeId
        ? createAgentFlowNodeSchemaAdapter({
            document,
            nodeId: selectedNodeId,
            setWorkingDocument,
            dispatch: () => undefined
          })
        : null,
    [document, enabled, selectedNodeId, setWorkingDocument]
  );

  return {
    document,
    selectedNodeId,
    selectedNode,
    schema,
    adapter
  };
}
