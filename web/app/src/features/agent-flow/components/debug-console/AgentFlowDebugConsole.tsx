import { SchemaDockPanel } from '../../../../shared/schema-ui/overlay-shell/SchemaDockPanel';
import type {
  AgentFlowDebugMessage,
  AgentFlowRunContext,
  AgentFlowTraceItem
} from '../../api/runtime';
import type { AgentFlowDebugSessionStatus } from '../../hooks/runtime/useAgentFlowDebugSession';
import { DebugConversationPane } from './conversation/DebugConversationPane';
import { DebugConsoleHeader } from './DebugConsoleHeader';
import {
  DebugConsoleTabs,
  type DebugConsoleTabKey
} from './DebugConsoleTabs';
import { DebugTracePane } from './trace/DebugTracePane';

const debugConsoleShellSchema = {
  schemaVersion: '1.0.0',
  shellType: 'dock_panel',
  title: '调试控制台'
} as const;

export function AgentFlowDebugConsole({
  activeNodeFilter,
  activeTab,
  messages,
  runContext,
  status,
  traceItems,
  onChangeRunContextValue,
  onChangeTab,
  onClearSession,
  onClose,
  onLocateTraceNode,
  onRerunLast,
  onStopRun,
  onSubmitPrompt
}: {
  activeNodeFilter: string | null;
  activeTab: DebugConsoleTabKey;
  messages: AgentFlowDebugMessage[];
  runContext: AgentFlowRunContext;
  status: AgentFlowDebugSessionStatus;
  traceItems: AgentFlowTraceItem[];
  onChangeRunContextValue: (nodeId: string, key: string, value: unknown) => void;
  onChangeTab: (key: DebugConsoleTabKey) => void;
  onClearSession: () => void;
  onClose: () => void;
  onLocateTraceNode: (nodeId: string | null) => void;
  onRerunLast: () => void;
  onStopRun: () => void;
  onSubmitPrompt: () => void;
}) {
  return (
    <SchemaDockPanel
      bodyClassName="agent-flow-editor__debug-console-body"
      className="agent-flow-editor__debug-console"
      headerless
      schema={debugConsoleShellSchema}
    >
      <DebugConsoleHeader
        clearDisabled={messages.length === 0 && traceItems.length === 0}
        rerunDisabled={messages.length === 0 || status === 'running'}
        stopDisabled={
          !['running', 'waiting_human', 'waiting_callback'].includes(status)
        }
        status={status}
        onClear={onClearSession}
        onClose={onClose}
        onRerun={onRerunLast}
        onStop={onStopRun}
      />
      <DebugConsoleTabs
        activeKey={activeTab}
        items={[
          {
            key: 'conversation',
            label: 'Input',
            children: (
              <DebugConversationPane
                messages={messages}
                runContext={runContext}
                status={status}
                onChangeQuery={(value) => {
                  const queryField =
                    runContext.fields.find((field) => field.key === 'query') ?? null;

                  if (!queryField) {
                    return;
                  }

                  onChangeRunContextValue(queryField.nodeId, queryField.key, value);
                }}
                onSelectTraceNode={(nodeId) => {
                  onChangeTab('trace');
                  onLocateTraceNode(nodeId);
                }}
                onSubmitPrompt={onSubmitPrompt}
                onViewTrace={() => onChangeTab('trace')}
              />
            )
          },
          {
            key: 'trace',
            label: 'Trace',
            children: (
              <DebugTracePane
                flowStatus={status}
                activeNodeFilter={activeNodeFilter}
                traceItems={traceItems}
                onSelectNode={onLocateTraceNode}
              />
            )
          }
        ]}
        onChange={onChangeTab}
      />
    </SchemaDockPanel>
  );
}
