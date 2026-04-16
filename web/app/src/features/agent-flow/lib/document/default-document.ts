import {
  createDefaultAgentFlowDocument,
  type FlowAuthoringDocument
} from '@1flowse/flow-schema';

export function buildDefaultAgentFlowDocument(
  flowId: string
): FlowAuthoringDocument {
  return createDefaultAgentFlowDocument({ flowId });
}
