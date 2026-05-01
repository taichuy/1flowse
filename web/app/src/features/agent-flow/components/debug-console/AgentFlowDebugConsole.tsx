import { SchemaDockPanel } from '../../../../shared/schema-ui/overlay-shell/SchemaDockPanel';
import type {
  AgentFlowDebugMessage,
  AgentFlowRunContext,
  AgentFlowTraceItem
} from '../../api/runtime';
import type { AgentFlowDebugSessionStatus } from '../../hooks/runtime/useAgentFlowDebugSession';
import { DebugConversationPane } from './conversation/DebugConversationPane';
import { DebugConsoleHeader } from './DebugConsoleHeader';
import { DebugTracePane } from './trace/DebugTracePane';

export type DebugConsoleTabKey = 'conversation' | 'trace';

const debugConsoleShellSchema = {
  schemaVersion: '1.0.0',
  shellType: 'dock_panel',
  title: '预览'
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
        mode={activeTab === 'trace' ? 'trace' : 'preview'}
        onBackToPreview={() => onChangeTab('conversation')}
        onClear={onClearSession}
        onClose={onClose}
      />
      {activeTab === 'trace' ? (
        <section
          aria-label="Trace 详情"
          className="agent-flow-editor__debug-trace-detail"
        >
          <DebugTracePane
            flowStatus={status}
            activeNodeFilter={activeNodeFilter}
            traceItems={traceItems}
            onSelectNode={onLocateTraceNode}
          />
        </section>
      ) : (
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
          onSubmitPrompt={onSubmitPrompt}
          onViewTrace={() => onChangeTab('trace')}
        />
      )}
    </SchemaDockPanel>
  );
}
