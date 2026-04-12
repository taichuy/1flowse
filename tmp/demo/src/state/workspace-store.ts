import { create } from 'zustand';

import {
  contracts,
  getNode,
  monitoringWindows,
  nodes,
  runs,
  type ContractMode,
  type MonitoringWindow,
  type RunFilter
} from '../data/workspace-data';

interface WorkspaceState {
  selectedNodeId: string;
  activeRunId: string | null;
  runFilter: RunFilter;
  contractMode: ContractMode;
  monitoringWindow: MonitoringWindow;
  setSelectedNodeId: (nodeId: string) => void;
  setRunFilter: (filter: RunFilter) => void;
  setContractMode: (mode: ContractMode) => void;
  setMonitoringWindow: (window: MonitoringWindow) => void;
  openRun: (runId: string) => void;
  closeRun: () => void;
  openFirstRunForFilter: (filter: RunFilter) => void;
  focusNodeAndFilter: (nodeId: string) => void;
}

const initialNodeId = nodes[1]?.id ?? nodes[0]?.id ?? 'unknown';

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedNodeId: initialNodeId,
  activeRunId: null,
  runFilter: 'all',
  contractMode: 'openai',
  monitoringWindow: '24h',
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setRunFilter: (filter) => set({ runFilter: filter }),
  setContractMode: (mode) =>
    set({
      contractMode: contracts[mode] ? mode : 'openai'
    }),
  setMonitoringWindow: (window) =>
    set({
      monitoringWindow: monitoringWindows[window] ? window : '24h'
    }),
  openRun: (runId) => set({ activeRunId: runId }),
  closeRun: () => set({ activeRunId: null }),
  openFirstRunForFilter: (filter) =>
    set({
      runFilter: filter,
      activeRunId:
        filter === 'all'
          ? runs[0]?.id ?? null
          : runs.find((run) => run.status === filter)?.id ?? null
    }),
  focusNodeAndFilter: (nodeId) =>
    set({
      selectedNodeId: nodeId,
      runFilter: getNode(nodeId)?.logsFilter ?? 'all'
    })
}));
