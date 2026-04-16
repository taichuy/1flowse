import type {
  ConsoleApplicationOrchestrationState,
  SaveConsoleApplicationDraftInput
} from '@1flowse/api-client';
import type { FlowAuthoringDocument } from '@1flowse/flow-schema';
import { Button, Typography } from 'antd';
import { useEffect, useMemo, useRef } from 'react';

import { restoreVersion, saveDraft } from '../../api/orchestration';
import { useEditorAutosave } from '../../hooks/useEditorAutosave';
import { validateDocument } from '../../lib/validate-document';
import { getContainerPathForNode } from '../../lib/default-agent-flow-document';
import { useAgentFlowEditorStore } from '../../store/editor/provider';
import {
  selectAutosaveStatus,
  selectLastSavedDocument,
  selectVersions,
  selectWorkingDocument
} from '../../store/editor/selectors';
import { useAuthStore } from '../../../../state/auth-store';
import { VersionHistoryDrawer } from '../history/VersionHistoryDrawer';
import { NodeInspector } from '../inspector/NodeInspector';
import { IssuesDrawer } from '../issues/IssuesDrawer';
import { AgentFlowCanvas } from './AgentFlowCanvas';
import { AgentFlowOverlay } from './AgentFlowOverlay';

interface AgentFlowCanvasFrameProps {
  applicationId: string;
  applicationName: string;
  saveDraftOverride?: (
    input: SaveConsoleApplicationDraftInput
  ) => Promise<ConsoleApplicationOrchestrationState>;
  restoreVersionOverride?: (
    versionId: string
  ) => Promise<ConsoleApplicationOrchestrationState>;
}

export function AgentFlowCanvasFrame({
  applicationId,
  applicationName,
  saveDraftOverride,
  restoreVersionOverride
}: AgentFlowCanvasFrameProps) {
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const workingDocument = useAgentFlowEditorStore(selectWorkingDocument);
  const lastSavedDocument = useAgentFlowEditorStore(selectLastSavedDocument);
  const autosaveStatus = useAgentFlowEditorStore(selectAutosaveStatus);
  const versions = useAgentFlowEditorStore(selectVersions);
  const autosaveIntervalMs = useAgentFlowEditorStore(
    (state) => state.autosaveIntervalMs
  );
  const selectedNodeId = useAgentFlowEditorStore((state) => state.selectedNodeId);
  const activeContainerPath = useAgentFlowEditorStore(
    (state) => state.activeContainerPath
  );
  const issuesOpen = useAgentFlowEditorStore((state) => state.issuesOpen);
  const historyOpen = useAgentFlowEditorStore((state) => state.historyOpen);
  const focusedFieldKey = useAgentFlowEditorStore(
    (state) => state.focusedFieldKey
  );
  const openInspectorSectionKey = useAgentFlowEditorStore(
    (state) => state.openInspectorSectionKey
  );
  const isRestoringVersion = useAgentFlowEditorStore(
    (state) => state.isRestoringVersion
  );
  const setWorkingDocument = useAgentFlowEditorStore(
    (state) => state.setWorkingDocument
  );
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);
  const setPanelState = useAgentFlowEditorStore((state) => state.setPanelState);
  const setInteractionState = useAgentFlowEditorStore(
    (state) => state.setInteractionState
  );
  const setAutosaveStatus = useAgentFlowEditorStore(
    (state) => state.setAutosaveStatus
  );
  const setSyncState = useAgentFlowEditorStore((state) => state.setSyncState);
  const focusIssueField = useAgentFlowEditorStore(
    (state) => state.focusIssueField
  );
  const replaceFromServerState = useAgentFlowEditorStore(
    (state) => state.replaceFromServerState
  );
  const documentRef = useRef(workingDocument);
  const lastSavedDocumentRef = useRef(lastSavedDocument);
  const viewportSnapshotRef = useRef(workingDocument.editor.viewport);
  const viewportGetterRef =
    useRef<(() => FlowAuthoringDocument['editor']['viewport']) | null>(null);
  const issues = useMemo(() => validateDocument(workingDocument), [workingDocument]);
  const activeContainerId = activeContainerPath.at(-1) ?? null;
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

  useEffect(() => {
    documentRef.current = workingDocument;
  }, [workingDocument]);

  useEffect(() => {
    lastSavedDocumentRef.current = lastSavedDocument;
  }, [lastSavedDocument]);

  function handleDocumentChange(nextDocument: FlowAuthoringDocument) {
    viewportSnapshotRef.current = nextDocument.editor.viewport;
    documentRef.current = nextDocument;
    setWorkingDocument(nextDocument);
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
    viewportSnapshotRef.current = nextState.draft.document.editor.viewport;
    documentRef.current = nextState.draft.document;
    lastSavedDocumentRef.current = nextState.draft.document;
    replaceFromServerState(nextState);
  }

  const autosaveController = useEditorAutosave({
    document: workingDocument,
    lastSavedDocument,
    getCurrentDocument: () => getDocumentWithLatestViewport(documentRef.current),
    getLastSavedDocument: () => lastSavedDocumentRef.current,
    intervalMs: autosaveIntervalMs,
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

  useEffect(() => {
    setAutosaveStatus(autosaveController.status);
    setSyncState({ isDirty: autosaveController.hasPendingChanges });
  }, [
    autosaveController.hasPendingChanges,
    autosaveController.status,
    setAutosaveStatus,
    setSyncState
  ]);

  async function handleRestore(versionId: string) {
    setSyncState({ isRestoringVersion: true });

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
      setInteractionState({ activeContainerPath: [] });
      setPanelState({ historyOpen: false });
    } finally {
      setSyncState({ isRestoringVersion: false });
    }
  }

  function handleSelectIssue(issue: (typeof issues)[number]) {
    setPanelState({ issuesOpen: false });

    if (!issue.nodeId) {
      return;
    }

    setInteractionState({
      activeContainerPath: getContainerPathForNode(workingDocument, issue.nodeId)
    });
    focusIssueField({
      nodeId: issue.nodeId,
      sectionKey: issue.sectionKey ?? null,
      fieldKey: issue.fieldKey ?? null
    });
  }

  function handleReturnToRootCanvas() {
    const currentContainerId = activeContainerPath.at(-1) ?? null;

    setInteractionState({ activeContainerPath: [] });
    setSelection({
      selectedNodeId: currentContainerId,
      selectedNodeIds: currentContainerId ? [currentContainerId] : []
    });
  }

  return (
    <section
      aria-label={`${applicationName} editor`}
      className="agent-flow-editor"
      data-application-id={applicationId}
    >
      <AgentFlowOverlay
        applicationName={applicationName}
        autosaveLabel={`${Math.round(autosaveIntervalMs / 1000)} 秒自动保存`}
        autosaveStatus={autosaveStatus}
        onSaveDraft={() => {
          void autosaveController.saveNow();
        }}
        saveDisabled={autosaveStatus === 'saving'}
        saveLoading={autosaveStatus === 'saving'}
        onOpenIssues={() => setPanelState({ issuesOpen: true })}
        onOpenHistory={() => setPanelState({ historyOpen: true })}
        onOpenPublish={() => undefined}
        publishDisabled={false}
      />
      {activeContainerId ? (
        <div className="agent-flow-editor__breadcrumb">
          <Button onClick={handleReturnToRootCanvas}>返回主画布</Button>
          <Typography.Text type="secondary">
            当前位于容器节点{' '}
            {
              workingDocument.graph.nodes.find((node) => node.id === activeContainerId)
                ?.alias
            }
          </Typography.Text>
        </div>
      ) : null}
      <div
        className={`agent-flow-editor__body agent-flow-editor__shell${selectedNodeId ? ' agent-flow-editor__body--with-inspector' : ''}`}
      >
        <AgentFlowCanvas
          issueCountByNodeId={issueCountByNodeId}
          onViewportSnapshotChange={(viewport) => {
            viewportSnapshotRef.current = viewport;
          }}
          onViewportGetterReady={(getter) => {
            viewportGetterRef.current = getter;
          }}
        />
        <NodeInspector
          document={workingDocument}
          selectedNodeId={selectedNodeId}
          focusFieldKey={focusedFieldKey}
          openSectionKey={openInspectorSectionKey}
          onDocumentChange={handleDocumentChange}
          onFocusHandled={() =>
            setSelection({
              focusedFieldKey: null
            })
          }
          onClose={() =>
            setSelection({
              selectedNodeId: null,
              selectedNodeIds: []
            })
          }
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
        onClose={() => setPanelState({ issuesOpen: false })}
        onSelectIssue={handleSelectIssue}
      />
      <VersionHistoryDrawer
        open={historyOpen}
        versions={versions}
        restoring={isRestoringVersion}
        onClose={() => setPanelState({ historyOpen: false })}
        onRestore={handleRestore}
      />
    </section>
  );
}
