export interface FlowDocument {
  id: string;
  name: string;
  nodes: Array<{ id: string; type: string }>;
}
