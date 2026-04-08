"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Collapse } from "antd";
import type { Node } from "@xyflow/react";

import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import type { WorkflowValidationNavigatorItem } from "@/lib/workflow-validation-navigation";
import {
  resolveWorkflowNodeInputSchema,
  resolveWorkflowNodeOutputSchema,
  type WorkflowCanvasNodeData
} from "@/lib/workflow-editor";
import { validateContractSchema } from "@/lib/workflow-contract-schema-validation";
import { getWorkflowNodeTypeDisplayLabel } from "@/lib/workflow-node-display";
import { WorkflowValidationRemediationCard } from "@/components/workflow-validation-remediation-card";
import { toRecord } from "@/components/workflow-node-config-form/shared";

export type WorkflowNodeIoSchemaFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  currentHref?: string | null;
  onInputSchemaChange: (nextSchema: Record<string, unknown> | undefined) => void;
  onOutputSchemaChange: (nextSchema: Record<string, unknown> | undefined) => void;
  highlighted?: boolean;
  highlightedFieldPath?: string | null;
  focusedValidationItem?: WorkflowValidationNavigatorItem | null;
  sandboxReadiness?: SandboxReadinessCheck | null;
  presentation?: "default" | "collapsible";
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
  currentHref = null,
  onInputSchemaChange,
  onOutputSchemaChange,
  highlighted = false,
  highlightedFieldPath = null,
  focusedValidationItem = null,
  sandboxReadiness = null,
  presentation = "default"
}: WorkflowNodeIoSchemaFormProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const normalizedHighlightedField = normalizeSchemaFieldKey(highlightedFieldPath);
  const isCollapsiblePresentation = presentation === "collapsible";
  const resolvedInputSchema = useMemo(
    () => resolveWorkflowNodeInputSchema(node.data.nodeType, node.data.inputSchema),
    [node.data.inputSchema, node.data.nodeType]
  );
  const resolvedOutputSchema = useMemo(
    () =>
      resolveWorkflowNodeOutputSchema(
        node.data.nodeType,
        resolvedInputSchema,
        node.data.outputSchema
      ),
    [node.data.nodeType, node.data.outputSchema, resolvedInputSchema]
  );
  const resolvedInputSchemaText = useMemo(
    () => stringifySchema(resolvedInputSchema),
    [resolvedInputSchema]
  );
  const resolvedOutputSchemaText = useMemo(
    () => stringifySchema(resolvedOutputSchema),
    [resolvedOutputSchema]
  );
  const [inputSchemaText, setInputSchemaText] = useState(() => resolvedInputSchemaText);
  const [outputSchemaText, setOutputSchemaText] = useState(() => resolvedOutputSchemaText);
  const [inputErrorMessage, setInputErrorMessage] = useState<string | null>(null);
  const [outputErrorMessage, setOutputErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"input" | "output" | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(() =>
    resolveExpandedSchemaKeys(normalizedHighlightedField, isCollapsiblePresentation)
  );

  useEffect(() => {
    setInputSchemaText(resolvedInputSchemaText);
    setOutputSchemaText(resolvedOutputSchemaText);
    setInputErrorMessage(null);
    setOutputErrorMessage(null);
    setCopiedField(null);
    setExpandedKeys(resolveExpandedSchemaKeys(normalizedHighlightedField, isCollapsiblePresentation));
  }, [
    node.id,
    resolvedInputSchemaText,
    resolvedOutputSchemaText,
    normalizedHighlightedField,
    isCollapsiblePresentation
  ]);

  useEffect(() => {
    if (!normalizedHighlightedField) {
      return;
    }

    if (isCollapsiblePresentation) {
      setExpandedKeys([normalizedHighlightedField]);
    }

    const target = sectionRef.current?.querySelector<HTMLElement>(
      `[data-validation-field="${normalizedHighlightedField}"] textarea`
    );

    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    target?.focus();
  }, [normalizedHighlightedField, isCollapsiblePresentation]);

  const inputSchemaFieldsCount = countSchemaFields(resolvedInputSchema);
  const outputSchemaFieldsCount = countSchemaFields(resolvedOutputSchema);

  const inputSchemaEditor = (
    <div
      className={`binding-field ${normalizedHighlightedField === "inputSchema" ? "validation-focus-ring" : ""}`.trim()}
      data-validation-field="inputSchema"
    >
      {isCollapsiblePresentation ? null : <span className="binding-label">Input schema JSON</span>}
      <textarea
        className="editor-json-area"
        value={inputSchemaText}
        onChange={(event) => setInputSchemaText(event.target.value)}
        placeholder="为空表示沿用节点默认输入约束"
      />
      <div className="tool-badge-row">
        <button
          className="sync-button"
          type="button"
          onClick={() =>
            handleApplySchema({
              value: inputSchemaText,
              errorPrefix: `Node '${node.id}' inputSchema`,
              onChange: onInputSchemaChange,
              setErrorMessage: setInputErrorMessage
            })
          }
        >
          {isCollapsiblePresentation ? "应用输入" : "应用 input schema"}
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => {
            setInputSchemaText(EMPTY_OBJECT_SCHEMA);
            setInputErrorMessage(null);
          }}
        >
          object 模板
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => {
            setInputSchemaText("");
            setInputErrorMessage(null);
            onInputSchemaChange(undefined);
          }}
        >
          {isCollapsiblePresentation ? "清空输入" : "清空 input schema"}
        </button>
      </div>
      {inputErrorMessage ? <p className="empty-state compact">{inputErrorMessage}</p> : null}
    </div>
  );

  const outputSchemaEditor = (
    <div
      className={`binding-field ${normalizedHighlightedField === "outputSchema" ? "validation-focus-ring" : ""}`.trim()}
      data-validation-field="outputSchema"
    >
      {isCollapsiblePresentation ? null : <span className="binding-label">Output schema JSON</span>}
      <textarea
        className="editor-json-area"
        value={outputSchemaText}
        onChange={(event) => setOutputSchemaText(event.target.value)}
        placeholder="为空表示节点输出仍由运行时和下游 mapping 自行约束"
      />
      <div className="tool-badge-row">
        <button
          className="sync-button"
          type="button"
          onClick={() =>
            handleApplySchema({
              value: outputSchemaText,
              errorPrefix: `Node '${node.id}' outputSchema`,
              onChange: onOutputSchemaChange,
              setErrorMessage: setOutputErrorMessage
            })
          }
        >
          {isCollapsiblePresentation ? "应用输出" : "应用 output schema"}
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => {
            setOutputSchemaText(EMPTY_OBJECT_SCHEMA);
            setOutputErrorMessage(null);
          }}
        >
          object 模板
        </button>
        <button
          className="sync-button"
          type="button"
          onClick={() => {
            setOutputSchemaText("");
            setOutputErrorMessage(null);
            onOutputSchemaChange(undefined);
          }}
        >
          {isCollapsiblePresentation ? "清空输出" : "清空 output schema"}
        </button>
      </div>
      {outputErrorMessage ? <p className="empty-state compact">{outputErrorMessage}</p> : null}
    </div>
  );

  return (
    <div
      className={`binding-form ${highlighted ? "validation-focus-ring" : ""}`.trim()}
      ref={sectionRef}
    >
      {isCollapsiblePresentation ? null : (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Node contract</p>
              <h3>Input / output schema</h3>
            </div>
          </div>

          <div className="tool-badge-row">
            <span className="event-chip">
              {getWorkflowNodeTypeDisplayLabel(node.data.nodeType, node.data.typeLabel)}
            </span>
            <span className="event-chip">input fields {inputSchemaFieldsCount}</span>
            <span className="event-chip">output fields {outputSchemaFieldsCount}</span>
          </div>
        </>
      )}

      {focusedValidationItem && normalizedHighlightedField ? (
        <WorkflowValidationRemediationCard
          currentHref={currentHref}
          item={focusedValidationItem}
          sandboxReadiness={sandboxReadiness}
        />
      ) : null}

      {isCollapsiblePresentation ? (
        <Collapse
          activeKey={expandedKeys}
          onChange={(keys) =>
            setExpandedKeys(Array.isArray(keys) ? keys.map(String) : [String(keys)])
          }
          className="workflow-editor-node-io-collapse"
          items={[
            {
              key: "inputSchema",
              label: buildSchemaCollapseLabel("输入", inputSchemaFieldsCount),
              extra: (
                <Button
                  type="text"
                  size="small"
                  className="workflow-editor-node-io-copy-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleCopySchema({
                      value: inputSchemaText,
                      field: "input",
                      setCopiedField
                    });
                  }}
                >
                  {copiedField === "input" ? "已复制输入" : "复制输入"}
                </Button>
              ),
              children: inputSchemaEditor
            },
            {
              key: "outputSchema",
              label: buildSchemaCollapseLabel("输出", outputSchemaFieldsCount),
              extra: (
                <Button
                  type="text"
                  size="small"
                  className="workflow-editor-node-io-copy-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleCopySchema({
                      value: outputSchemaText,
                      field: "output",
                      setCopiedField
                    });
                  }}
                >
                  {copiedField === "output" ? "已复制输出" : "复制输出"}
                </Button>
              ),
              children: outputSchemaEditor
            }
          ]}
        />
      ) : (
        <>
          {inputSchemaEditor}
          {outputSchemaEditor}
          <p className="section-copy">
            这层先把节点契约从通用 config JSON 中分离出来，并复用与后端保存链路一致的最小
            contract 校验；后续再继续演进成更细粒度的 schema builder。
          </p>
        </>
      )}
    </div>
  );
}

function handleApplySchema(options: {
  value: string;
  errorPrefix: string;
  onChange: (nextSchema: Record<string, unknown> | undefined) => void;
  setErrorMessage: (value: string | null) => void;
}) {
  try {
    const nextSchema = parseSchemaText(options.value, options.errorPrefix);
    options.setErrorMessage(null);
    options.onChange(nextSchema);
  } catch (error) {
    options.setErrorMessage(
      error instanceof Error ? error.message : "Schema 不是合法 JSON 对象。"
    );
  }
}

async function handleCopySchema({
  value,
  field,
  setCopiedField
}: {
  value: string;
  field: "input" | "output";
  setCopiedField: (value: "input" | "output" | null) => void;
}) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(value.trim() || EMPTY_OBJECT_SCHEMA);
  setCopiedField(field);
}

function parseSchemaText(value: string, errorPrefix: string) {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = JSON.parse(normalized) as unknown;
  const record = toRecord(parsed);
  if (!record) {
    throw new Error("Schema 必须是 JSON 对象。");
  }
  validateContractSchema(record, { errorPrefix });
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

function normalizeSchemaFieldKey(fieldPath?: string | null) {
  const normalized = fieldPath?.trim();
  if (!normalized) {
    return null;
  }

  if (normalized === "inputSchema" || normalized.startsWith("inputSchema.")) {
    return "inputSchema";
  }

  if (normalized === "outputSchema" || normalized.startsWith("outputSchema.")) {
    return "outputSchema";
  }

  return null;
}

function resolveExpandedSchemaKeys(
  highlightedField: "inputSchema" | "outputSchema" | null,
  isCollapsiblePresentation: boolean
) {
  if (!isCollapsiblePresentation || !highlightedField) {
    return [];
  }

  return [highlightedField];
}

function buildSchemaCollapseLabel(title: string, fieldCount: number) {
  return (
    <span className="workflow-editor-node-io-collapse-label">
      <span>{title}</span>
      <span className="workflow-editor-node-io-collapse-count">{fieldCount} 个字段</span>
    </span>
  );
}
