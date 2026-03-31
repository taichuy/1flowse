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
  const selectedSourceNode =
    availableNodes.find((candidate) => candidate.id === selectedSourceNodeId) ?? null;
  const readableNodeSummary = readableNodeIds.map((readableNodeId) => {
    const relatedNode = availableNodes.find((candidate) => candidate.id === readableNodeId) ?? null;
    return {
      id: readableNodeId,
      label: relatedNode?.data.label ?? readableNodeId,
      typeLabel: relatedNode?.data.typeLabel ?? relatedNode?.data.nodeType ?? "upstream"
    };
  });

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

      <div className="binding-help">
        <strong>{selectedSourceNode ? "当前引用焦点" : "先选一个上游作为引用源"}</strong>
        <span>
          {selectedSourceNode
            ? `${selectedSourceNode.data.label ?? selectedSourceNode.id} 已写入 reference.sourceNodeId；如需更多上下文，可继续在下方追加额外可读节点。`
            : "在 Source node 里选择节点时，表单会自动把它加入显式授权；Reference 仍不会偷渡全部上游上下文。"}
        </span>
      </div>

      {readableNodeSummary.length > 0 ? (
        <div className="binding-field">
          <span className="binding-label">Authorized upstreams</span>
          <div className="tool-badge-row">
            {readableNodeSummary.map((item) => (
              <span className="event-chip" key={`reference-readable-${item.id}`}>
                {item.label} · {item.typeLabel}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <AuthorizedContextFields
        nodeId={node.id}
        availableNodes={availableNodes}
        readableNodeIds={readableNodeIds}
        readableArtifacts={readableArtifacts}
        onToggleReadableNode={toggleReadableNode}
        onToggleReadableArtifact={toggleReadableArtifact}
        readableNodesLabel="Additional readable upstreams"
        readableNodesHint="选 Source node 会自动补齐当前主引用的显式授权；这里继续追加其它可读上游，不会偷渡全局上下文。"
      />

      <label className="binding-field">
        <span className="binding-label">Source node</span>
        <select
          value={selectedSourceNodeId}
          onChange={(event) => handleSourceNodeChange(event.target.value)}
        >
          <option value="">选择一个上游，自动补齐 sourceNodeId 与显式授权</option>
          {availableNodes.map((candidate) => {
            const isAuthorized = readableNodeIds.includes(candidate.id);
            const isSelected = candidate.id === selectedSourceNodeId;
            const typeLabel = candidate.data.typeLabel ?? candidate.data.nodeType;
            return (
              <option key={candidate.id} value={candidate.id}>
                {`${candidate.data.label ?? candidate.id} · ${typeLabel} · ${
                  isSelected ? "当前 source" : isAuthorized ? "已授权" : "选择后自动授权"
                }`}
              </option>
            );
          })}
        </select>
        <small className="section-copy">
          主引用会写入 <code>reference.sourceNodeId</code>，并继续固定读取上游 <code>json</code>{" "}
          输出；后续若补 artifact store 引用，再在这里扩展更多类型。
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
