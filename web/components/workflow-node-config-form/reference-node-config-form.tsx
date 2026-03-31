"use client";

import React from "react";
import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import { AuthorizedContextFields } from "@/components/workflow-node-config-form/authorized-context-fields";
import {
  cloneRecord,
  dedupeArtifactRefs,
  dedupeStrings,
  readReadableArtifacts,
  toRecord,
  toStringArray
} from "@/components/workflow-node-config-form/shared";

type ReferenceNodeConfigFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  nodes: Array<Node<WorkflowCanvasNodeData>>;
  onChange: (nextConfig: Record<string, unknown>) => void;
};

export function ReferenceNodeConfigForm({
  node,
  nodes,
  onChange
}: ReferenceNodeConfigFormProps) {
  const config = cloneRecord(node.data.config);
  const contextAccess = toRecord(config.contextAccess) ?? {};
  const reference = toRecord(config.reference) ?? {};
  const availableNodes = nodes.filter((candidate) => candidate.id !== node.id);
  const readableArtifacts = readReadableArtifacts(contextAccess.readableArtifacts);
  const readableNodeIds = Array.from(
    new Set([
      ...toStringArray(contextAccess.readableNodeIds),
      ...readableArtifacts.map((artifact) => artifact.nodeId)
    ])
  );
  const selectedSourceNodeId =
    typeof reference.sourceNodeId === "string" ? reference.sourceNodeId : "";

  const updateConfig = (
    nextReadableNodeIds: string[],
    nextReadableArtifacts: Array<{ nodeId: string; artifactType: string }>,
    nextSourceNodeId: string
  ) => {
    const nextConfig = cloneRecord(config);
    const normalizedReadableNodeIds = dedupeStrings(nextReadableNodeIds);
    const normalizedReadableArtifacts = dedupeArtifactRefs(nextReadableArtifacts);
    const nextContextAccess: Record<string, unknown> = {};

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

    if (nextSourceNodeId) {
      nextConfig.reference = {
        sourceNodeId: nextSourceNodeId,
        artifactType: "json"
      };
    } else {
      delete nextConfig.reference;
    }

    onChange(nextConfig);
  };

  const toggleReadableNode = (nodeId: string, checked: boolean) => {
    const nextReadableNodeIds = checked
      ? dedupeStrings([...readableNodeIds, nodeId])
      : readableNodeIds.filter((currentNodeId) => currentNodeId !== nodeId);
    const nextReadableArtifacts = checked
      ? readableArtifacts
      : readableArtifacts.filter((artifact) => artifact.nodeId !== nodeId);
    const nextSourceNodeId = selectedSourceNodeId === nodeId && !checked ? "" : selectedSourceNodeId;

    updateConfig(nextReadableNodeIds, nextReadableArtifacts, nextSourceNodeId);
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

    updateConfig(readableNodeIds, nextReadableArtifacts, selectedSourceNodeId);
  };

  const handleSourceNodeChange = (value: string) => {
    if (!value) {
      updateConfig(readableNodeIds, readableArtifacts, "");
      return;
    }

    const nextReadableNodeIds = readableNodeIds.includes(value)
      ? readableNodeIds
      : [...readableNodeIds, value];
    updateConfig(nextReadableNodeIds, readableArtifacts, value);
  };

  return (
    <div className="binding-form" data-component="reference-node-config-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Structured config</p>
          <h3>Reference source</h3>
        </div>
      </div>

      <AuthorizedContextFields
        nodeId={node.id}
        availableNodes={availableNodes}
        readableNodeIds={readableNodeIds}
        readableArtifacts={readableArtifacts}
        onToggleReadableNode={toggleReadableNode}
        onToggleReadableArtifact={toggleReadableArtifact}
        readableNodesLabel="Readable nodes"
        readableNodesHint="Reference 节点只允许显式引用已授权的上游节点输出，不会偷渡全局上下文。"
      />

      <label className="binding-field">
        <span className="binding-label">Source node</span>
        <select
          value={selectedSourceNodeId}
          onChange={(event) => handleSourceNodeChange(event.target.value)}
        >
          <option value="">选择一个已授权节点</option>
          {readableNodeIds.map((readableNodeId) => {
            const relatedNode =
              availableNodes.find((candidate) => candidate.id === readableNodeId) ?? null;
            return (
              <option key={readableNodeId} value={readableNodeId}>
                {relatedNode?.data.label ?? readableNodeId}
              </option>
            );
          })}
        </select>
        <small className="section-copy">
          当前最小实现先固定引用上游 <code>json</code> 输出；后续若补 artifact store 引用，再在这里扩展更多类型。
        </small>
      </label>

      <div className="binding-field">
        <span className="binding-label">Artifact type</span>
        <div className="tool-badge-row">
          <span className="event-chip">json</span>
        </div>
      </div>
    </div>
  );
}
