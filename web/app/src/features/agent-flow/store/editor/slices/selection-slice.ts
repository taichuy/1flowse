import type { InspectorSectionKey } from '../../../lib/node-definitions';

export interface SelectionSlice {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[];
  selectionMode: 'single' | 'multiple';
  focusedFieldKey: string | null;
  openInspectorSectionKey: InspectorSectionKey | null;
}
