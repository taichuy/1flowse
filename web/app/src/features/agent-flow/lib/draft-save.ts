import type { SaveConsoleApplicationDraftInput } from '@1flowse/api-client';
import type { FlowAuthoringDocument } from '@1flowse/flow-schema';

import { classifyDocumentChange } from './document/change-kind';
import { buildVersionSummary } from './history-change';

export function buildDraftSaveInput(
  lastSavedDocument: FlowAuthoringDocument,
  document: FlowAuthoringDocument
): SaveConsoleApplicationDraftInput {
  return {
    document,
    change_kind: classifyDocumentChange(lastSavedDocument, document),
    summary: buildVersionSummary(lastSavedDocument, document)
  };
}
