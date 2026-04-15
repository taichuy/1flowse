import type {
  ConsoleApplicationOrchestrationState,
  SaveConsoleApplicationDraftInput
} from '@1flowse/api-client';
import type { FlowAuthoringDocument } from '@1flowse/flow-schema';
import { Button, Typography } from 'antd';
import { useMemo, useRef, useState } from 'react';

import { restoreVersion, saveDraft } from '../../api/orchestration';
import { validateDocument } from '../../lib/validate-document';
import { useEditorAutosave } from '../../hooks/useEditorAutosave';
import { IssuesDrawer } from '../issues/IssuesDrawer';
import { VersionHistoryDrawer } from '../history/VersionHistoryDrawer';
import { NodeInspector } from '../inspector/NodeInspector';
import { AgentFlowCanvas } from './AgentFlowCanvas';
import { AgentFlowOverlay } from './AgentFlowOverlay';
import './agent-flow-editor.css';
import { useAuthStore } from '../../../../state/auth-store';
import type { InspectorSectionKey } from '../../lib/node-definitions';

interface AgentFlowEditorShellProps {
  applicationId: string;
  applicationName: string;
  initialState: ConsoleApplicationOrchestrationState;
  saveDraftOverride?: (
    input: SaveConsoleApplicationDraftInput
  ) => Promise<ConsoleApplicationOrchestrationState>;
  restoreVersionOverride?: (
    versionId: string
  ) => Promise<ConsoleApplicationOrchestrationState>;
}

function buildContainerPathForNode(
  document: ConsoleApplicationOrchestrationState['draft']['document'],
  nodeId: string | null
) {
  if (!nodeId) {
    return [];
  }

  const path: string[] = [];
  let currentNode = document.graph.nodes.find((node) => node.id === nodeId) ?? null;

  while (currentNode?.containerId) {
    path.unshift(currentNode.containerId);
    currentNode =
      document.graph.nodes.find((node) => node.id === currentNode?.containerId) ?? null;
  }

  return path;
}

export function AgentFlowEditorShell({
  applicationId,
  applicationName,
  initialState,
  saveDraftOverride,
  restoreVersionOverride
}: AgentFlowEditorShellProps) {
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const [editorState, setEditorState] = useState(initialState);
  const [document, setDocument] = useState(initialState.draft.document);
  const documentRef = useRef(initialState.draft.document);
  const lastSavedDocumentRef = useRef(initialState.draft.document);
  const viewportSnapshotRef = useRef(initialState.draft.document.editor.viewport);
  const viewportGetterRef =
    useRef<(() => FlowAuthoringDocument['editor']['viewport']) | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-llm');
  const [containerPath, setContainerPath] = useState<string[]>([]);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusFieldKey, setFocusFieldKey] = useState<string | null>(null);
  const [openSectionKey, setOpenSectionKey] = useState<InspectorSectionKey | null>(null);
  const [restoring, setRestoring] = useState(false);
  const issues = useMemo(() => validateDocument(document), [document]);
  const activeContainerId = containerPath.at(-1) ?? null;
  const issueCountByNodeId = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const issue of issues) {
      if (!issue.nodeId) {
        continue;
      }

      counts[issue.nodeId] = (counts[issue.nodeId] ?? 0) + 1;
    }

    return counts;
  }, [issues]);

  function handleDocumentChange(nextDocument: FlowAuthoringDocument) {
    viewportSnapshotRef.current = nextDocument.editor.viewport;
    documentRef.current = nextDocument;
    setDocument(nextDocument);
  }

  function getDocumentWithLatestViewport(currentDocument: FlowAuthoringDocument) {
    const viewport = viewportGetterRef.current?.() ?? viewportSnapshotRef.current;
    const currentViewport = currentDocument.editor.viewport;

    if (
      currentViewport.x === viewport.x &&
      currentViewport.y === viewport.y &&
      currentViewport.zoom === viewport.zoom
    ) {
      return currentDocument;
    }

    return {
      ...currentDocument,
      editor: {
        ...currentDocument.editor,
        viewport
      }
    };
  }

  function applyServerState(nextState: ConsoleApplicationOrchestrationState) {
    setEditorState(nextState);
    lastSavedDocumentRef.current = nextState.draft.document;
    viewportSnapshotRef.current = nextState.draft.document.editor.viewport;
    documentRef.current = nextState.draft.document;
    setDocument(nextState.draft.document);
  }

  const autosaveController = useEditorAutosave({
    document,
    lastSavedDocument: editorState.draft.document,
    getCurrentDocument: () => getDocumentWithLatestViewport(documentRef.current),
    getLastSavedDocument: () => lastSavedDocumentRef.current,
    intervalMs: editorState.autosave_interval_seconds * 1000,
    onSave: async (input) => {
      const nextState = saveDraftOverride
        ? await saveDraftOverride(input)
        : await (() => {
            if (!csrfToken) {
              throw new Error('missing csrf token');
            }

            return saveDraft(applicationId, input, csrfToken);
          })();

      applyServerState(nextState);
    }
  });

  async function handleRestore(versionId: string) {
    setRestoring(true);

    try {
      const nextState = restoreVersionOverride
        ? await restoreVersionOverride(versionId)
        : await (() => {
            if (!csrfToken) {
              throw new Error('missing csrf token');
            }

            return restoreVersion(applicationId, versionId, csrfToken);
          })();

      applyServerState(nextState);
      setContainerPath([]);
      setHistoryOpen(false);
    } finally {
      setRestoring(false);
    }
  }

  function handleSelectIssue(issue: (typeof issues)[number]) {
    setIssuesOpen(false);

    if (!issue.nodeId) {
      return;
    }

    setContainerPath(buildContainerPathForNode(document, issue.nodeId));
    setSelectedNodeId(issue.nodeId);
    setOpenSectionKey(issue.sectionKey ?? null);
    setFocusFieldKey(issue.fieldKey ?? null);
  }

  function handleOpenContainer(nodeId: string) {
    setContainerPath((previous) => [...previous, nodeId]);
    const firstChildNode =
      document.graph.nodes.find((node) => node.containerId === nodeId)?.id ?? null;
    setSelectedNodeId(firstChildNode);
  }

  function handleReturnToRootCanvas() {
    const currentContainerId = containerPath.at(-1) ?? null;
    setContainerPath([]);
    setSelectedNodeId(currentContainerId);
  }

  return (
    <section
      aria-label={`${applicationName} editor`}
      className="agent-flow-editor"
      data-application-id={applicationId}
    >
      <AgentFlowOverlay
        applicationName={applicationName}
        autosaveLabel={`${editorState.autosave_interval_seconds} 秒自动保存`}
        autosaveStatus={autosaveController.status}
        onSaveDraft={() => {
          void autosaveController.saveNow();
        }}
        saveDisabled={autosaveController.status === 'saving'}
        saveLoading={autosaveController.status === 'saving'}
        onOpenIssues={() => setIssuesOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPublish={() => undefined}
        publishDisabled={false}
      />
      {activeContainerId ? (
        <div className="agent-flow-editor__breadcrumb">
          <Button onClick={handleReturnToRootCanvas}>返回主画布</Button>
          <Typography.Text type="secondary">
            当前位于容器节点 {document.graph.nodes.find((node) => node.id === activeContainerId)?.alias}
          </Typography.Text>
        </div>
      ) : null}
      <div
        className={`agent-flow-editor__body agent-flow-editor__shell${selectedNodeId ? ' agent-flow-editor__body--with-inspector' : ''}`}
      >
        <AgentFlowCanvas
          activeContainerId={activeContainerId}
          document={document}
          issueCountByNodeId={issueCountByNodeId}
          onOpenContainer={handleOpenContainer}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onDocumentChange={handleDocumentChange}
          onViewportSnapshotChange={(viewport) => {
            viewportSnapshotRef.current = viewport;
          }}
          onViewportGetterReady={(getter) => {
            viewportGetterRef.current = getter;
          }}
        />
        <NodeInspector
          document={document}
          selectedNodeId={selectedNodeId}
          focusFieldKey={focusFieldKey}
          openSectionKey={openSectionKey}
          onDocumentChange={handleDocumentChange}
          onFocusHandled={() => setFocusFieldKey(null)}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
      {issues.some((issue) => issue.scope === 'global') ? (
        <Typography.Text type="danger">
          当前草稿存在全局问题，请先查看 Issues 面板处理。
        </Typography.Text>
      ) : null}
      <IssuesDrawer
        open={issuesOpen}
        issues={issues}
        onClose={() => setIssuesOpen(false)}
        onSelectIssue={handleSelectIssue}
      />
      <VersionHistoryDrawer
        open={historyOpen}
        versions={editorState.versions}
        restoring={restoring}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestore}
      />
    </section>
  );
}
