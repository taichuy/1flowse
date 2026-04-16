export interface PanelSlice {
  issuesOpen: boolean;
  historyOpen: boolean;
  publishConfigOpen: boolean;
  nodePickerState: {
    open: boolean;
    anchorNodeId: string | null;
    anchorEdgeId: string | null;
  };
}
