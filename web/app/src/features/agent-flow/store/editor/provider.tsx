import {
  createContext,
  useContext,
  type Context
} from 'react';
import { useStore } from 'zustand';

import {
  createAgentFlowEditorStore,
  type AgentFlowEditorState
} from './index';

export type AgentFlowEditorStore = ReturnType<typeof createAgentFlowEditorStore>;

export const AgentFlowEditorStoreContext: Context<AgentFlowEditorStore | null> =
  createContext<AgentFlowEditorStore | null>(null);

export function useAgentFlowEditorStore<T>(
  selector: (state: AgentFlowEditorState) => T
) {
  const store = useContext(AgentFlowEditorStoreContext);

  if (!store) {
    throw new Error('AgentFlowEditorStoreProvider is missing');
  }

  return useStore(store, selector);
}
