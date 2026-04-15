import type {
  ConsoleApplicationOrchestrationState,
  SaveConsoleApplicationDraftInput
} from '@1flowse/api-client';
import { Typography } from 'antd';
import { useState } from 'react';

import { AgentFlowCanvas } from './AgentFlowCanvas';
import { AgentFlowOverlay } from './AgentFlowOverlay';
import './agent-flow-editor.css';

interface AgentFlowEditorShellProps {
  applicationId: string;
  applicationName: string;
  initialState: ConsoleApplicationOrchestrationState;
  saveDraftOverride?: (
    input: SaveConsoleApplicationDraftInput
  ) => Promise<ConsoleApplicationOrchestrationState>;
}

export function AgentFlowEditorShell({
  applicationId,
  applicationName,
  initialState
}: AgentFlowEditorShellProps) {
  const [document, setDocument] = useState(initialState.draft.document);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-llm');

  const selectedNode =
    document.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;

  return (
    <section
      aria-label={`${applicationName} editor`}
      className="agent-flow-editor"
      data-application-id={applicationId}
    >
      <AgentFlowOverlay
        applicationName={applicationName}
        autosaveLabel={`${initialState.autosave_interval_seconds} 秒自动保存`}
        onOpenIssues={() => undefined}
        onOpenHistory={() => undefined}
        onOpenPublish={() => undefined}
        publishDisabled={false}
      />
      <div className="agent-flow-editor__body">
        <AgentFlowCanvas
          document={document}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onDocumentChange={setDocument}
        />
        <aside className="agent-flow-editor__sidebar">
          <Typography.Text type="secondary">当前选中</Typography.Text>
          <Typography.Title className="agent-flow-editor__sidebar-title" level={5}>
            {selectedNode ? `${selectedNode.alias} 配置` : '未选择节点'}
          </Typography.Title>
          <Typography.Paragraph className="agent-flow-editor__sidebar-copy">
            {selectedNode
              ? '下一步会在这里接入节点配置表单和绑定编辑器。'
              : '点击节点后即可在这里查看节点详情。'}
          </Typography.Paragraph>
        </aside>
      </div>
    </section>
  );
}
