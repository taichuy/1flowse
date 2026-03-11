"use client";

import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import { cloneRecord } from "@/components/workflow-node-config-form/shared";

type OutputNodeConfigFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  onChange: (nextConfig: Record<string, unknown>) => void;
};

export function OutputNodeConfigForm({
  node,
  onChange
}: OutputNodeConfigFormProps) {
  const config = cloneRecord(node.data.config);

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
          <p className="eyebrow">Structured config</p>
          <h3>Output shaping</h3>
        </div>
      </div>

      <label className="binding-field">
        <span className="binding-label">Format</span>
        <select
          className="binding-select"
          value={typeof config.format === "string" ? config.format : "json"}
          onChange={(event) => updateField("format", event.target.value)}
        >
          <option value="json">json</option>
          <option value="text">text</option>
          <option value="markdown">markdown</option>
          <option value="message">message</option>
        </select>
      </label>

      <label className="binding-field">
        <span className="binding-label">Response key</span>
        <input
          className="trace-text-input"
          value={typeof config.responseKey === "string" ? config.responseKey : ""}
          onChange={(event) => updateField("responseKey", event.target.value.trim() || undefined)}
          placeholder="例如 result / answer / output"
        />
      </label>

      <label className="binding-field">
        <span className="binding-label">Content type</span>
        <input
          className="trace-text-input"
          value={typeof config.contentType === "string" ? config.contentType : ""}
          onChange={(event) => updateField("contentType", event.target.value.trim() || undefined)}
          placeholder="例如 application/json"
        />
      </label>

      <label className="binding-field">
        <span className="binding-label">Response notes</span>
        <textarea
          className="editor-json-area"
          value={typeof config.instructions === "string" ? config.instructions : ""}
          onChange={(event) => updateField("instructions", event.target.value || undefined)}
          placeholder="说明最终结果如何整形、裁剪或转成发布层响应"
        />
      </label>

      <label className="binding-field">
        <span className="binding-label">Include run metadata</span>
        <input
          type="checkbox"
          checked={Boolean(config.includeRunMetadata)}
          onChange={(event) => updateField("includeRunMetadata", event.target.checked)}
        />
        <small className="section-copy">
          为后续 API 调用开放预留响应整形入口，复杂 schema 仍可继续走高级 JSON。
        </small>
      </label>
    </div>
  );
}
