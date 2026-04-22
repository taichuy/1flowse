import { useRef, type PropsWithChildren } from 'react';
import type { ConsoleApplicationOrchestrationState } from '@1flowbase/api-client';

import {
  AgentFlowEditorStoreContext,
  type AgentFlowEditorStore
} from './provider';
import { createAgentFlowEditorStore } from './index';

export function AgentFlowEditorStoreProvider({
  initialState,
  children
}: PropsWithChildren<{
  initialState: ConsoleApplicationOrchestrationState;
}>) {
  const storeRef = useRef<AgentFlowEditorStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createAgentFlowEditorStore(initialState);
  }

  return (
    <AgentFlowEditorStoreContext.Provider value={storeRef.current}>
      {children}
    </AgentFlowEditorStoreContext.Provider>
  );
}
