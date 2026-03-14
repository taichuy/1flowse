"use client";

import { useEffect, useState } from "react";
import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import { toRecord } from "@/components/workflow-node-config-form/shared";

type WorkflowNodeIoSchemaFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  onInputSchemaChange: (nextSchema: Record<string, unknown> | undefined) => void;
  onOutputSchemaChange: (nextSchema: Record<string, unknown> | undefined) => void;
};

const EMPTY_OBJECT_SCHEMA = JSON.stringify(
  {
    type: "object",
    properties: {},
    required: []
  },
  null,
  2
);

export function WorkflowNodeIoSchemaForm({
  node,
  onInputSchemaChange,
  onOutputSchemaChange
}: WorkflowNodeIoSchemaFormProps) {
  const [inputSchemaText, setInputSchemaText] = useState(stringifySchema(node.data.inputSchema));
  const [outputSchemaText, setOutputSchemaText] = useState(stringifySchema(node.data.outputSchema));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setInputSchemaText(stringifySchema(node.data.inputSchema));
    setOutputSchemaText(stringifySchema(node.data.outputSchema));
    setErrorMessage(null);
  }, [node.id, node.data.inputSchema, node.data.outputSchema]);

  const inputSchemaFieldsCount = countSchemaFields(node.data.inputSchema);
  const outputSchemaFieldsCount = countSchemaFields(node.data.outputSchema);

  return (
    <div className="binding-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Node contract</p>
          <h3>Input / output schema</h3>
        </div>
      </div>

      <div className="tool-badge-row">
        <span className="event-chip">{node.data.nodeType}</span>
        <span className="event-chip">input fields {inputSchemaFieldsCount}</span>
        <span className="event-chip">output fields {outputSchemaFieldsCount}</span>
      </div>

      <label className="binding-field">
        <span className="binding-label">Input schema JSON</span>
        <textarea
          className="editor-json-area"
          value={inputSchemaText}
          onChange={(event) => setInputSchemaText(event.target.value)}
          placeholder="为空表示沿用节点默认输入约束"
        />
      </label>

      <div className="tool-badge-row">
        <button
          className="sync-button"
          type="button"
          onClick={() => handleApplySchema(inputSchemaText, onInputSchemaChange, setErrorMessage)}
        >
          应用 input schema
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => setInputSchemaText(EMPTY_OBJECT_SCHEMA)}
        >
          object 模板
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => {
            setInputSchemaText("");
            setErrorMessage(null);
            onInputSchemaChange(undefined);
          }}
        >
          清空 input schema
        </button>
      </div>

      <label className="binding-field">
        <span className="binding-label">Output schema JSON</span>
        <textarea
          className="editor-json-area"
          value={outputSchemaText}
          onChange={(event) => setOutputSchemaText(event.target.value)}
          placeholder="为空表示节点输出仍由运行时和下游 mapping 自行约束"
        />
      </label>

      <div className="tool-badge-row">
        <button
          className="sync-button"
          type="button"
          onClick={() => handleApplySchema(outputSchemaText, onOutputSchemaChange, setErrorMessage)}
        >
          应用 output schema
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => setOutputSchemaText(EMPTY_OBJECT_SCHEMA)}
        >
          object 模板
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => {
            setOutputSchemaText("");
            setErrorMessage(null);
            onOutputSchemaChange(undefined);
          }}
        >
          清空 output schema
        </button>
      </div>

      <p className="section-copy">
        这层先把节点契约从通用 config JSON 中分离出来，便于后续继续演进成更细粒度的 schema
        builder；复杂 JsonSchema 关键字仍可直接保留在这里维护。
      </p>

      {errorMessage ? <p className="empty-state compact">{errorMessage}</p> : null}
    </div>
  );
}

function handleApplySchema(
  value: string,
  onChange: (nextSchema: Record<string, unknown> | undefined) => void,
  setErrorMessage: (value: string | null) => void
) {
  try {
    const nextSchema = parseSchemaText(value);
    setErrorMessage(null);
    onChange(nextSchema);
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "Schema 不是合法 JSON 对象。");
  }
}

function parseSchemaText(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = JSON.parse(normalized) as unknown;
  const record = toRecord(parsed);
  if (!record) {
    throw new Error("Schema 必须是 JSON 对象。");
  }
  return record;
}

function stringifySchema(value: Record<string, unknown> | null | undefined) {
  return value ? JSON.stringify(value, null, 2) : "";
}

function countSchemaFields(value: Record<string, unknown> | null | undefined) {
  const schema = toRecord(value);
  const properties = toRecord(schema?.properties);
  return properties ? Object.keys(properties).length : 0;
}
