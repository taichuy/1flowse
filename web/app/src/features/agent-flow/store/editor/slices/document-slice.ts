import type { ConsoleFlowVersionSummary } from '@1flowse/api-client';
import type { FlowAuthoringDocument } from '@1flowse/flow-schema';

export interface DocumentSlice {
  workingDocument: FlowAuthoringDocument;
  lastSavedDocument: FlowAuthoringDocument;
  draftMeta: {
    draftId: string;
    flowId: string;
    updatedAt: string;
  };
  versions: ConsoleFlowVersionSummary[];
}
