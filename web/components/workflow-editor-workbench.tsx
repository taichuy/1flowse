"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ReactFlowProvider,
  addEdge,
  type Node,
  type OnConnect,
  type OnSelectionChangeParams,
  useEdgesState,
  useNodesState
} from "@xyflow/react";

import { getApiBaseUrl } from "@/lib/api-base-url";
import type {
  WorkflowLibrarySourceLane,
  WorkflowNodeCatalogItem
} from "@/lib/get-workflow-library";
import type { RunDetail } from "@/lib/get-run-detail";
import type { RunTrace } from "@/lib/get-run-trace";
import { getWorkflowRuns, type WorkflowRunListItem } from "@/lib/get-workflow-runs";
import type { WorkflowDetail, WorkflowListItem } from "@/lib/get-workflows";
import { buildWorkspaceStarterPayload } from "@/lib/workspace-starter-payload";
import { inferWorkflowBusinessTrack } from "@/lib/workflow-starters";
import {
  buildEditorEdge,
  createWorkflowNodeDraft,
  reactFlowToWorkflowDefinition,
  workflowDefinitionToReactFlow,
  type WorkflowCanvasEdgeData,
  type WorkflowCanvasNodeData
} from "@/lib/workflow-editor";
import type { PluginToolRegistryItem } from "@/lib/get-plugin-registry";
import { getPaletteNodeCatalog } from "@/lib/workflow-node-catalog";
import { WorkflowEditorCanvas } from "@/components/workflow-editor-workbench/workflow-editor-canvas";
import { WorkflowEditorHero } from "@/components/workflow-editor-workbench/workflow-editor-hero";
import { fetchRunDetail, fetchRunTrace } from "@/components/workflow-editor-workbench/run-overlay";
import {
  isRecord,
  readNodePosition,
  stringifyJson,
  stripUiPosition
} from "@/components/workflow-editor-workbench/shared";
import { WorkflowEditorSidebar } from "@/components/workflow-editor-workbench/workflow-editor-sidebar";
import {
  applyRunOverlayToNodes,
  WORKFLOW_EDITOR_NODE_TYPES
} from "@/components/workflow-editor-workbench/workflow-canvas-node";
import { WorkflowEditorInspector } from "@/components/workflow-editor-inspector";

type WorkflowEditorWorkbenchProps = {
  workflow: WorkflowDetail;
  workflows: WorkflowListItem[];
  nodeCatalog: WorkflowNodeCatalogItem[];
  nodeSourceLanes: WorkflowLibrarySourceLane[];
  toolSourceLanes: WorkflowLibrarySourceLane[];
  tools: PluginToolRegistryItem[];
  recentRuns: WorkflowRunListItem[];
};

export function WorkflowEditorWorkbench({
  workflow,
  workflows,
  nodeCatalog,
  nodeSourceLanes,
  toolSourceLanes,
  tools,
  recentRuns
}: WorkflowEditorWorkbenchProps) {
  const initialGraph = workflowDefinitionToReactFlow(nodeCatalog, workflow.definition);
  const editorNodeLibrary = getPaletteNodeCatalog(nodeCatalog);
  const primaryNodeLane = nodeSourceLanes[0] ?? null;
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [persistedWorkflowName, setPersistedWorkflowName] = useState(workflow.name);
  const [workflowVersion, setWorkflowVersion] = useState(workflow.version);
  const [persistedDefinition, setPersistedDefinition] = useState(workflow.definition);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialGraph.nodes[0]?.id ?? null
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [nodeConfigText, setNodeConfigText] = useState(() =>
    stringifyJson(initialGraph.nodes[0]?.data.config ?? {})
  );
  const [availableRuns, setAvailableRuns] = useState(recentRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    recentRuns[0]?.id ?? null
  );
  const [selectedRunDetail, setSelectedRunDetail] = useState<RunDetail | null>(null);
  const [selectedRunTrace, setSelectedRunTrace] = useState<RunTrace | null>(null);
  const [runOverlayError, setRunOverlayError] = useState<string | null>(null);
  const [isLoadingRunOverlay, setIsLoadingRunOverlay] = useState(false);
  const [isRefreshingRuns, setIsRefreshingRuns] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | "idle">("idle");
  const [isSaving, startSavingTransition] = useTransition();
  const [isSavingStarter, startSaveStarterTransition] = useTransition();

  const displayedNodes = applyRunOverlayToNodes(nodes, selectedRunDetail, selectedRunTrace);
  const selectedNode = displayedNodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const currentDefinition = reactFlowToWorkflowDefinition(nodes, edges, persistedDefinition);
  const isDirty =
    workflowName.trim() !== persistedWorkflowName ||
    JSON.stringify(currentDefinition) !== JSON.stringify(persistedDefinition);

  useEffect(() => {
    const nextGraph = workflowDefinitionToReactFlow(nodeCatalog, workflow.definition);
    setWorkflowName(workflow.name);
    setPersistedWorkflowName(workflow.name);
    setWorkflowVersion(workflow.version);
    setPersistedDefinition(workflow.definition);
    setNodes(nextGraph.nodes);
    setEdges(nextGraph.edges);
    setSelectedNodeId(nextGraph.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    setNodeConfigText(stringifyJson(nextGraph.nodes[0]?.data.config ?? {}));
    setAvailableRuns(recentRuns);
    setSelectedRunId(recentRuns[0]?.id ?? null);
    setSelectedRunDetail(null);
    setSelectedRunTrace(null);
    setRunOverlayError(null);
    setIsLoadingRunOverlay(false);
    setIsRefreshingRuns(false);
    setMessage(null);
    setMessageTone("idle");
  }, [nodeCatalog, recentRuns, workflow, setEdges, setNodes]);

  useEffect(() => {
    setNodeConfigText(stringifyJson(selectedNode?.data.config ?? {}));
  }, [selectedNodeId, selectedNode?.data.config]);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedRunId) {
      setSelectedRunDetail(null);
      setSelectedRunTrace(null);
      setRunOverlayError(null);
      setIsLoadingRunOverlay(false);
      return () => {
        isCancelled = true;
      };
    }

    setIsLoadingRunOverlay(true);

    void Promise.all([fetchRunDetail(selectedRunId), fetchRunTrace(selectedRunId)]).then(
      ([runDetail, traceResult]) => {
        if (isCancelled) {
          return;
        }

        setSelectedRunDetail(runDetail);
        setSelectedRunTrace(traceResult.trace);
        setRunOverlayError(traceResult.errorMessage);
        setIsLoadingRunOverlay(false);
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [selectedRunId]);

  const onConnect: OnConnect = (connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    setEdges((currentEdges) =>
      addEdge(buildEditorEdge(connection.source, connection.target), currentEdges)
    );
    setSelectedEdgeId(null);
    setMessage(null);
    setMessageTone("idle");
  };

  const handleSelectionChange = (selection: OnSelectionChangeParams) => {
    const nextNode = selection.nodes[0];
    const nextEdge = selection.edges[0];
    setSelectedNodeId(nextNode?.id ?? null);
    setSelectedEdgeId(nextEdge?.id ?? null);
  };

  const handleAddNode = (type: string) => {
    const draft = createWorkflowNodeDraft(nodeCatalog, type, nodes.length + 1);
    const nextNode: Node<WorkflowCanvasNodeData> = {
      id: draft.id,
      type: "workflowNode",
      position: readNodePosition(draft.config),
      data: {
        label: draft.name,
        nodeType: draft.type,
        config: stripUiPosition(draft.config)
      },
      selected: true
    };

    setNodes((currentNodes) => [...currentNodes, nextNode]);
    setSelectedNodeId(nextNode.id);
    setSelectedEdgeId(null);
    setMessage(`${draft.name} 已加入画布，记得保存 workflow。`);
    setMessageTone("success");
  };

  const handleNodeNameChange = (value: string) => {
    if (!selectedNodeId) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                label: value
              }
            }
          : node
      )
    );
  };

  const handleSelectedNodeConfigChange = (nextConfig: Record<string, unknown>) => {
    if (!selectedNodeId) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config: nextConfig
              }
            }
          : node
      )
    );
    setMessage(null);
    setMessageTone("idle");
  };

  const applyNodeConfigJson = () => {
    if (!selectedNodeId) {
      return;
    }

    try {
      const parsed = JSON.parse(nodeConfigText) as unknown;
      if (!isRecord(parsed)) {
        throw new Error("节点 config 必须是 JSON 对象。");
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  config: parsed
                }
              }
            : node
        )
      );
      setMessage("节点 config 已应用到本地画布。");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "节点 config 不是合法 JSON。");
      setMessageTone("error");
    }
  };

  const handleNodeRuntimePolicyChange = (value: string) => {
    if (!selectedNodeId) {
      return;
    }

    if (!value.trim()) {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  runtimePolicy: undefined
                }
              }
            : node
        )
      );
      setMessage("已清空 runtimePolicy。");
      setMessageTone("success");
      return;
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!isRecord(parsed)) {
        throw new Error("runtimePolicy 必须是 JSON 对象。");
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  runtimePolicy: parsed
                }
              }
            : node
        )
      );
      setMessage("runtimePolicy 已应用。");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "runtimePolicy 不是合法 JSON。");
      setMessageTone("error");
    }
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNode) {
      return;
    }

    if (selectedNode.data.nodeType === "trigger") {
      setMessage("最小编辑器暂不允许删除唯一 trigger 节点。");
      setMessageTone("error");
      return;
    }

    if (
      selectedNode.data.nodeType === "output" &&
      nodes.filter((node) => node.data.nodeType === "output").length <= 1
    ) {
      setMessage("至少保留一个 output 节点，避免保存后被后端校验拒绝。");
      setMessageTone("error");
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNode.id));
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
      )
    );
    setSelectedNodeId(null);
    setMessage(`节点 ${selectedNode.data.label} 已从画布移除。`);
    setMessageTone("success");
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdge) {
      return;
    }

    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedEdge.id));
    setSelectedEdgeId(null);
    setMessage("已移除所选连线。");
    setMessageTone("success");
  };

  const updateSelectedEdge = (
    patch: Partial<WorkflowCanvasEdgeData> & { label?: string | undefined }
  ) => {
    if (!selectedEdgeId) {
      return;
    }

    const { label, ...dataPatch } = patch;

    setEdges((currentEdges) =>
      currentEdges.map((edge) =>
        edge.id === selectedEdgeId
          ? {
              ...edge,
              ...(label !== undefined ? { label } : {}),
              ...(dataPatch.channel
                ? {
                    animated: dataPatch.channel === "data"
                  }
                : {}),
              data: {
                ...(edge.data ?? { channel: "control" }),
                ...dataPatch
              }
            }
          : edge
      )
    );
  };

  const refreshRecentRuns = async () => {
    setIsRefreshingRuns(true);
    const refreshedRuns = await getWorkflowRuns(workflow.id);
    setAvailableRuns(refreshedRuns);
    setSelectedRunId((currentRunId) => {
      if (currentRunId && refreshedRuns.some((run) => run.id === currentRunId)) {
        return currentRunId;
      }
      return refreshedRuns[0]?.id ?? null;
    });
    setIsRefreshingRuns(false);
  };

  const handleSave = () => {
    const nextDefinition = reactFlowToWorkflowDefinition(nodes, edges, persistedDefinition);
    startSavingTransition(async () => {
      setMessage("正在保存 workflow definition...");
      setMessageTone("idle");

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/workflows/${encodeURIComponent(workflow.id)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: workflowName.trim() || workflow.name,
              definition: nextDefinition
            })
          }
        );
        const body = (await response.json().catch(() => null)) as
          | { detail?: string; version?: string }
          | null;

        if (!response.ok) {
          setMessage(body?.detail ?? `保存失败，API 返回 ${response.status}。`);
          setMessageTone("error");
          return;
        }

        setPersistedWorkflowName(workflowName.trim() || workflow.name);
        setPersistedDefinition(nextDefinition);
        setWorkflowVersion(body?.version ?? workflowVersion);
        setMessage(`已保存 workflow，当前版本 ${body?.version ?? workflowVersion}。`);
        setMessageTone("success");
      } catch {
        setMessage("无法连接后端保存 workflow，请确认 API 已启动。");
        setMessageTone("error");
      }
    });
  };

  const handleSaveAsWorkspaceStarter = () => {
    const nextDefinition = reactFlowToWorkflowDefinition(nodes, edges, persistedDefinition);
    const businessTrack = inferWorkflowBusinessTrack(nextDefinition);
    const normalizedWorkflowName = workflowName.trim() || workflow.name;
    const starterPayload = buildWorkspaceStarterPayload({
      workflowId: workflow.id,
      workflowName: normalizedWorkflowName,
      workflowVersion,
      businessTrack,
      definition: nextDefinition
    });

    startSaveStarterTransition(async () => {
      setMessage("正在保存到 workspace starter library...");
      setMessageTone("idle");

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/workspace-starters`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(starterPayload)
        });
        const body = (await response.json().catch(() => null)) as
          | { detail?: string; name?: string }
          | null;

        if (!response.ok) {
          setMessage(body?.detail ?? `保存模板失败，API 返回 ${response.status}。`);
          setMessageTone("error");
          return;
        }

        setMessage(
          `已保存 workspace starter：${body?.name ?? starterPayload.name}。回到创建页即可复用。`
        );
        setMessageTone("success");
      } catch {
        setMessage("无法连接后端保存 workspace starter，请确认 API 已启动。");
        setMessageTone("error");
      }
    });
  };

  return (
    <ReactFlowProvider>
      <main className="editor-shell">
        <WorkflowEditorHero
          workflowId={workflow.id}
          workflowVersion={workflowVersion}
          nodesCount={nodes.length}
          edgesCount={edges.length}
          toolsCount={tools.length}
          availableRunsCount={availableRuns.length}
          isDirty={isDirty}
          selectedNodeLabel={selectedNode?.data.label ?? null}
          selectedEdgeId={selectedEdge?.id ?? null}
          workflowsCount={workflows.length}
          selectedRunAttached={Boolean(selectedRunId)}
          isSaving={isSaving}
          isSavingStarter={isSavingStarter}
          onSave={handleSave}
          onSaveAsWorkspaceStarter={handleSaveAsWorkspaceStarter}
        />

        <section className="editor-workspace">
          <WorkflowEditorSidebar
            workflowId={workflow.id}
            workflowName={workflowName}
            workflows={workflows}
            primaryNodeLane={primaryNodeLane}
            toolSourceLanes={toolSourceLanes}
            editorNodeLibrary={editorNodeLibrary}
            message={message}
            messageTone={messageTone}
            runs={availableRuns}
            selectedRunId={selectedRunId}
            run={selectedRunDetail}
            trace={selectedRunTrace}
            traceError={runOverlayError}
            selectedNodeId={selectedNodeId}
            isLoadingRunOverlay={isLoadingRunOverlay}
            isRefreshingRuns={isRefreshingRuns}
            onWorkflowNameChange={setWorkflowName}
            onAddNode={handleAddNode}
            onSelectRunId={setSelectedRunId}
            onRefreshRuns={refreshRecentRuns}
          />

          <WorkflowEditorCanvas
            nodes={displayedNodes}
            edges={edges}
            nodeTypes={WORKFLOW_EDITOR_NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
          />

          <aside className="editor-inspector">
            <WorkflowEditorInspector
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              nodes={nodes}
              tools={tools}
              nodeConfigText={nodeConfigText}
              onNodeConfigTextChange={setNodeConfigText}
              onApplyNodeConfigJson={applyNodeConfigJson}
              onNodeNameChange={handleNodeNameChange}
              onNodeConfigChange={handleSelectedNodeConfigChange}
              onNodeRuntimePolicyChange={handleNodeRuntimePolicyChange}
              onDeleteSelectedNode={handleDeleteSelectedNode}
              onUpdateSelectedEdge={updateSelectedEdge}
              onDeleteSelectedEdge={handleDeleteSelectedEdge}
            />
          </aside>
        </section>
      </main>
    </ReactFlowProvider>
  );
}
