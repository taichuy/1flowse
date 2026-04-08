export type WorkflowEditorRuntimeRequest = {
  nodeId: string;
  requestId: number;
};

export function doesWorkflowEditorRuntimeRequestTargetNode(
  runtimeRequest: WorkflowEditorRuntimeRequest | null | undefined,
  nodeId: string | null | undefined
) {
  return Boolean(runtimeRequest && nodeId && runtimeRequest.nodeId === nodeId);
}
