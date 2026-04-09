"use client";

import React from "react";
import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import { cloneRecord, toRecord } from "@/components/workflow-node-config-form/shared";
import {
  parseReplyTemplateToDocument,
  serializeReplyDocumentToTemplate,
  type WorkflowVariableReference,
  type WorkflowVariableReferenceGroup,
  type WorkflowVariableReferenceItem,
  type WorkflowVariableTextDocument,
} from "@/components/workflow-node-config-form/workflow-variable-text-document";
import { WorkflowVariableTextEditor } from "@/components/workflow-node-config-form/workflow-variable-text-editor";

type OutputNodeConfigFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  nodes: Array<Node<WorkflowCanvasNodeData>>;
  onChange: (nextConfig: Record<string, unknown>) => void;
};

function isWorkflowVariableTextDocument(value: unknown): value is WorkflowVariableTextDocument {
  const record = toRecord(value);
  return (
    record?.version === 1 &&
    Array.isArray(record.segments) &&
    record.segments.every((segment) => {
      const segmentRecord = toRecord(segment);
      if (!segmentRecord || typeof segmentRecord.type !== "string") {
        return false;
      }

      if (segmentRecord.type === "text") {
        return typeof segmentRecord.text === "string";
      }

      if (segmentRecord.type === "variable") {
        return typeof segmentRecord.refId === "string";
      }

      return false;
    })
  );
}

function isWorkflowVariableReference(value: unknown): value is WorkflowVariableReference {
  const record = toRecord(value);
  return (
    typeof record?.refId === "string" &&
    typeof record.alias === "string" &&
    typeof record.ownerNodeId === "string" &&
    Array.isArray(record.selector) &&
    record.selector.every((segment) => typeof segment === "string")
  );
}

function readSchemaFieldNames(schema: unknown) {
  const schemaRecord = toRecord(schema);
  const properties = toRecord(schemaRecord?.properties);
  return properties ? Object.keys(properties) : [];
}

function buildLeafItem({
  key,
  label,
  selector,
  ownerNodeId,
}: {
  key: string;
  label: string;
  selector: string[];
  ownerNodeId: string;
}): WorkflowVariableReferenceItem {
  const aliasBase = selector.at(-1) || "value";
  const machineName = `${ownerNodeId}.${aliasBase}`;

  return {
    key,
    label,
    selector,
    previewPath: selector.join("."),
    machineName,
    token: `{{#${machineName}#}}`,
  };
}

function buildReplyVariableGroups({
  ownerNodeId,
  node,
  nodes,
}: {
  ownerNodeId: string;
  node: Node<WorkflowCanvasNodeData>;
  nodes: Array<Node<WorkflowCanvasNodeData>>;
}) {
  const currentFieldNames = readSchemaFieldNames(node.data.inputSchema);
  const currentNodeItems = (currentFieldNames.length > 0 ? currentFieldNames : ["text"]).map(
    (fieldName) =>
      buildLeafItem({
        key: `mapped-${fieldName}`,
        label: fieldName,
        selector: [fieldName],
        ownerNodeId,
      }),
  );

  const startNode = nodes.find((candidate) => candidate.data.nodeType === "startNode");
  const triggerFieldNames = readSchemaFieldNames(startNode?.data.inputSchema);
  const triggerItems = (triggerFieldNames.length > 0 ? triggerFieldNames : ["query", "files"]).map(
    (fieldName) =>
      buildLeafItem({
        key: `trigger-${fieldName}`,
        label: `trigger_input.${fieldName}`,
        selector: ["trigger_input", fieldName],
        ownerNodeId,
      }),
  );

  const upstreamItems = nodes
    .filter((candidate) => candidate.id !== node.id && candidate.data.nodeType !== "startNode")
    .map((candidate) => {
      const outputFieldNames = readSchemaFieldNames(candidate.data.outputSchema);
      const fieldNames = outputFieldNames.length > 0 ? outputFieldNames : ["text", "answer"];

      return {
        key: `upstream-${candidate.id}`,
        label: candidate.data.label,
        selector: ["accumulated", candidate.id],
        previewPath: `accumulated.${candidate.id}`,
        machineName: `${ownerNodeId}.${candidate.id}`,
        token: `{{#${ownerNodeId}.${candidate.id}#}}`,
        children: fieldNames.map((fieldName) =>
          buildLeafItem({
            key: `upstream-${candidate.id}-${fieldName}`,
            label: `${candidate.data.label}.${fieldName}`,
            selector: ["accumulated", candidate.id, fieldName],
            ownerNodeId,
          }),
        ),
      } satisfies WorkflowVariableReferenceItem;
    });

  return [
    {
      key: "current-node",
      label: "当前节点变量",
      items: currentNodeItems,
    },
    {
      key: "trigger-input",
      label: "Trigger input",
      items: triggerItems,
    },
    {
      key: "upstream-nodes",
      label: "上游节点",
      items: upstreamItems,
    },
  ] satisfies WorkflowVariableReferenceGroup[];
}

function normalizeReplyState({
  nodeId,
  ownerLabel,
  config,
}: {
  nodeId: string;
  ownerLabel: string;
  config: Record<string, unknown>;
}) {
  const replyDocument = config.replyDocument;
  const replyReferences = config.replyReferences;

  if (
    isWorkflowVariableTextDocument(replyDocument) &&
    Array.isArray(replyReferences) &&
    replyReferences.every(isWorkflowVariableReference)
  ) {
    return {
      document: replyDocument,
      references: replyReferences,
    };
  }

  return parseReplyTemplateToDocument({
    ownerNodeId: nodeId,
    ownerLabel,
    replyTemplate: typeof config.replyTemplate === "string" ? config.replyTemplate : "",
  });
}

export function OutputNodeConfigForm({
  node,
  nodes,
  onChange,
}: OutputNodeConfigFormProps) {
  const config = cloneRecord(node.data.config);
  const normalizedReplyState = normalizeReplyState({
    nodeId: node.id,
    ownerLabel: node.data.label,
    config,
  });
  const variableGroups = buildReplyVariableGroups({
    ownerNodeId: node.id,
    node,
    nodes,
  });

  const updateField = (field: string, value: unknown) => {
    const nextConfig = cloneRecord(config);

    if (value === undefined || value === "") {
      delete nextConfig[field];
    } else {
      nextConfig[field] = value;
    }

    onChange(nextConfig);
  };

  return (
    <div className="binding-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Direct reply</p>
          <h3>直接回复</h3>
        </div>
      </div>

      <label className="binding-field compact-stack">
        <span className="binding-label">回复内容</span>
        <WorkflowVariableTextEditor
          ownerNodeId={node.id}
          ownerLabel={node.data.label}
          value={normalizedReplyState.document}
          references={normalizedReplyState.references}
          variables={variableGroups}
          placeholder="输入正文，输入 / 插入变量"
          onChange={({ document, references }) => {
            const nextConfig = cloneRecord(config);
            const replyTemplate = serializeReplyDocumentToTemplate({
              document,
              references,
            });

            nextConfig.replyDocument = document;
            nextConfig.replyReferences = references;

            if (replyTemplate) {
              nextConfig.replyTemplate = replyTemplate;
            } else {
              delete nextConfig.replyTemplate;
            }

            onChange(nextConfig);
          }}
        />
        <small className="section-copy">
          直接回复现在以结构化变量文档作为主事实源。输入 `/` 可以搜索上游节点、当前节点字段与
          `trigger_input`，复制出去的机器别名统一是 `当前节点 id.alias`。
        </small>
      </label>

      <label className="binding-field">
        <span className="binding-label">回复字段名</span>
        <input
          className="trace-text-input"
          value={typeof config.responseKey === "string" ? config.responseKey : ""}
          onChange={(event) => updateField("responseKey", event.target.value.trim() || undefined)}
          placeholder="默认是 answer，也可以改成 reply / message"
        />
      </label>
    </div>
  );
}
