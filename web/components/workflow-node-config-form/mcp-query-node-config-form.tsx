"use client";

import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import { AuthorizedContextFields } from "@/components/workflow-node-config-form/authorized-context-fields";
import {
  cloneRecord,
  dedupeArtifactRefs,
  dedupeStrings,
  MCP_ARTIFACT_TYPES,
  readReadableArtifacts,
  toRecord,
  toStringArray
} from "@/components/workflow-node-config-form/shared";

type McpQueryNodeConfigFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  nodes: Array<Node<WorkflowCanvasNodeData>>;
  onChange: (nextConfig: Record<string, unknown>) => void;
};

export function McpQueryNodeConfigForm({
  node,
  nodes,
  onChange
}: McpQueryNodeConfigFormProps) {
  const config = cloneRecord(node.data.config);
  const contextAccess = toRecord(config.contextAccess) ?? {};
  const query: Record<string, unknown> = toRecord(config.query) ?? {
    type: "authorized_context"
  };
  const availableNodes = nodes.filter((candidate) => candidate.id !== node.id);
  const readableArtifacts = readReadableArtifacts(contextAccess.readableArtifacts);
  const readableNodeIds = Array.from(
    new Set([
      ...toStringArray(contextAccess.readableNodeIds),
      ...readableArtifacts.map((artifact) => artifact.nodeId)
    ])
  );
  const querySourceNodeIds = toStringArray(query.sourceNodeIds);
  const queryArtifactTypes = toStringArray(query.artifactTypes);
  const effectiveQueryArtifactTypes =
    queryArtifactTypes.length > 0 ? queryArtifactTypes : ["json"];

  const updateConfig = (
    nextReadableNodeIds: string[],
    nextReadableArtifacts: Array<{ nodeId: string; artifactType: string }>,
    nextQueryPatch?: Record<string, unknown>
  ) => {
    const nextConfig = cloneRecord(config);
    const nextContextAccess: Record<string, unknown> = {};
    const normalizedReadableNodeIds = dedupeStrings(nextReadableNodeIds);
    const normalizedReadableArtifacts = dedupeArtifactRefs(nextReadableArtifacts);

    if (normalizedReadableNodeIds.length > 0) {
      nextContextAccess.readableNodeIds = normalizedReadableNodeIds;
    }
    if (normalizedReadableArtifacts.length > 0) {
      nextContextAccess.readableArtifacts = normalizedReadableArtifacts;
    }

    if (Object.keys(nextContextAccess).length === 0) {
      delete nextConfig.contextAccess;
    } else {
      nextConfig.contextAccess = nextContextAccess;
    }

    const nextQuery: Record<string, unknown> = {
      type: "authorized_context",
      ...cloneRecord(query),
      ...(nextQueryPatch ?? {})
    };

    const normalizedSourceNodeIds = dedupeStrings(toStringArray(nextQuery.sourceNodeIds));
    if (normalizedSourceNodeIds.length > 0) {
      nextQuery.sourceNodeIds = normalizedSourceNodeIds;
    } else {
      delete nextQuery.sourceNodeIds;
    }

    const normalizedArtifactTypes = dedupeStrings(toStringArray(nextQuery.artifactTypes));
    if (normalizedArtifactTypes.length > 0) {
      nextQuery.artifactTypes = normalizedArtifactTypes;
    } else {
      delete nextQuery.artifactTypes;
    }

    nextConfig.query = nextQuery;
    onChange(nextConfig);
  };

  const toggleReadableNode = (nodeId: string, checked: boolean) => {
    const nextReadableNodeIds = checked
      ? dedupeStrings([...readableNodeIds, nodeId])
      : readableNodeIds.filter((currentNodeId) => currentNodeId !== nodeId);
    const nextReadableArtifacts = checked
      ? readableArtifacts
      : readableArtifacts.filter((artifact) => artifact.nodeId !== nodeId);
    const nextQuerySourceNodeIds = checked
      ? querySourceNodeIds
      : querySourceNodeIds.filter((currentNodeId) => currentNodeId !== nodeId);

    updateConfig(nextReadableNodeIds, nextReadableArtifacts, {
      sourceNodeIds: nextQuerySourceNodeIds
    });
  };

  const toggleReadableArtifact = (
    nodeId: string,
    artifactType: string,
    checked: boolean
  ) => {
    const nextReadableArtifacts = checked
      ? [...readableArtifacts, { nodeId, artifactType }]
      : readableArtifacts.filter(
          (artifact) =>
            artifact.nodeId !== nodeId || artifact.artifactType !== artifactType
        );

    updateConfig(readableNodeIds, nextReadableArtifacts);
  };

  const toggleQuerySource = (nodeId: string, checked: boolean) => {
    const nextQuerySourceNodeIds = checked
      ? [...querySourceNodeIds, nodeId]
      : querySourceNodeIds.filter((currentNodeId) => currentNodeId !== nodeId);

    updateConfig(readableNodeIds, readableArtifacts, {
      sourceNodeIds: nextQuerySourceNodeIds
    });
  };

  const toggleQueryArtifactType = (artifactType: string, checked: boolean) => {
    const currentArtifactTypes = queryArtifactTypes.length > 0 ? queryArtifactTypes : ["json"];
    const nextArtifactTypes = checked
      ? [...currentArtifactTypes, artifactType]
      : currentArtifactTypes.filter((currentType) => currentType !== artifactType);

    updateConfig(readableNodeIds, readableArtifacts, {
      artifactTypes: nextArtifactTypes
    });
  };

  return (
    <div className="binding-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Structured config</p>
          <h3>MCP authorized context</h3>
        </div>
      </div>

      <div className="binding-field">
        <span className="binding-label">Query type</span>
        <div className="tool-badge-row">
          <span className="event-chip">authorized_context</span>
        </div>
        <small className="section-copy">
          当前 editor 先围绕已落地的 `authorized_context` 查询模型提供结构化编辑。
        </small>
      </div>

      <AuthorizedContextFields
        nodeId={node.id}
        availableNodes={availableNodes}
        readableNodeIds={readableNodeIds}
        readableArtifacts={readableArtifacts}
        onToggleReadableNode={toggleReadableNode}
        onToggleReadableArtifact={toggleReadableArtifact}
        readableNodesLabel="Readable nodes (默认授权 JSON)"
        readableNodesHint="先声明可读取来源，再决定 query source 与 artifact types。"
      />

      <div className="binding-field">
        <span className="binding-label">Query source nodes</span>
        {readableNodeIds.length === 0 ? (
          <p className="empty-state compact">先授权至少一个节点，再选择 query source。</p>
        ) : (
          <div className="tool-badge-row">
            {readableNodeIds.map((readableNodeId) => {
              const relatedNode =
                availableNodes.find((candidate) => candidate.id === readableNodeId) ?? null;
              return (
                <label key={`${node.id}-source-${readableNodeId}`}>
                  <input
                    type="checkbox"
                    checked={querySourceNodeIds.includes(readableNodeId)}
                    onChange={(event) =>
                      toggleQuerySource(readableNodeId, event.target.checked)
                    }
                  />{" "}
                  {relatedNode?.data.label ?? readableNodeId}
                </label>
              );
            })}
          </div>
        )}
        <small className="section-copy">
          不勾选时会沿用后端默认语义: 读取全部已授权 source。
        </small>
      </div>

      <div className="binding-field">
        <span className="binding-label">Query artifact types</span>
        <div className="tool-badge-row">
          {MCP_ARTIFACT_TYPES.map((artifactType) => (
            <label key={`${node.id}-query-artifact-${artifactType}`}>
              <input
                type="checkbox"
                checked={effectiveQueryArtifactTypes.includes(artifactType)}
                onChange={(event) =>
                  toggleQueryArtifactType(artifactType, event.target.checked)
                }
              />{" "}
              {artifactType}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
