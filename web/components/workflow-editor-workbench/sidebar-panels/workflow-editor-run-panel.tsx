"use client";

import type { RunSnapshotWithId } from "@/app/actions/run-snapshot";
import { WorkflowRunOverlayPanel } from "@/components/workflow-run-overlay-panel";
import type { RunDetail } from "@/lib/get-run-detail";
import type { RunTrace } from "@/lib/get-run-trace";
import type {
  CallbackWaitingAutomationCheck,
  SandboxReadinessCheck
} from "@/lib/get-system-overview";
import type { WorkflowRunListItem } from "@/lib/get-workflow-runs";
import type { WorkspaceStarterGovernanceQueryScope } from "@/lib/workspace-starter-governance-query";

export type WorkflowEditorRunPanelProps = {
  currentHref?: string;
  runs: WorkflowRunListItem[];
  selectedRunId: string | null;
  run: RunDetail | null;
  runSnapshot: RunSnapshotWithId | null;
  trace: RunTrace | null;
  traceError: string | null;
  selectedNodeId: string | null;
  callbackWaitingAutomation?: CallbackWaitingAutomationCheck | null;
  sandboxReadiness?: SandboxReadinessCheck | null;
  workspaceStarterGovernanceQueryScope?: WorkspaceStarterGovernanceQueryScope | null;
  isLoading: boolean;
  isRefreshingRuns: boolean;
  onSelectRunId: (runId: string | null) => void;
  onRefreshRuns: () => void;
};

export function WorkflowEditorRunPanel({
  currentHref,
  runs,
  selectedRunId,
  run,
  runSnapshot,
  trace,
  traceError,
  selectedNodeId,
  callbackWaitingAutomation,
  sandboxReadiness,
  workspaceStarterGovernanceQueryScope,
  isLoading,
  isRefreshingRuns,
  onSelectRunId,
  onRefreshRuns
}: WorkflowEditorRunPanelProps) {
  return (
    <div data-component="workflow-editor-run-overlay-panel">
      <WorkflowRunOverlayPanel
        currentHref={currentHref}
        runs={runs}
        selectedRunId={selectedRunId}
        run={run}
        runSnapshot={runSnapshot}
        trace={trace}
        traceError={traceError}
        selectedNodeId={selectedNodeId}
        callbackWaitingAutomation={callbackWaitingAutomation}
        sandboxReadiness={sandboxReadiness}
        workspaceStarterGovernanceQueryScope={workspaceStarterGovernanceQueryScope}
        isLoading={isLoading}
        isRefreshingRuns={isRefreshingRuns}
        onSelectRunId={onSelectRunId}
        onRefreshRuns={onRefreshRuns}
      />
    </div>
  );
}
