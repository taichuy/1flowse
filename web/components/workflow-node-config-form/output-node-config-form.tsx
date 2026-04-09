"use client";

import React from "react";
import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import { cloneRecord } from "@/components/workflow-node-config-form/shared";

type OutputNodeConfigFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  nodes: Array<Node<WorkflowCanvasNodeData>>;
  onChange: (nextConfig: Record<string, unknown>) => void;
};

function formatReplyToken(path: string) {
  return `{{#${path}#}}`;
}

export function OutputNodeConfigForm({
  node,
  nodes,
  onChange
}: OutputNodeConfigFormProps) {
  const config = cloneRecord(node.data.config);
  const candidateNodes = nodes.filter((item) => item.id !== node.id);
  const replyTemplate = typeof config.replyTemplate === "string" ? config.replyTemplate : "";

  const updateField = (field: string, value: unknown) => {
    const nextConfig = cloneRecord(config);
    if (value === undefined || value === "") {
      delete nextConfig[field];
    } else {
      nextConfig[field] = value;
    }
    onChange(nextConfig);
  };

  const insertReplyToken = (token: string) => {
    const normalizedTemplate = replyTemplate.trimEnd();
    const nextTemplate = normalizedTemplate ? `${normalizedTemplate}\n${token}` : token;
    updateField("replyTemplate", nextTemplate);
  };

  const commonTokens = [
    formatReplyToken("text"),
    formatReplyToken("trigger_input.query"),
    formatReplyToken("accumulated.answer"),
  ];

  return (
    <div className="binding-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Direct reply</p>
          <h3>直接回复</h3>
        </div>
      </div>

      <label className="binding-field">
        <span className="binding-label">回复模板</span>
        <textarea
          className="editor-json-area"
          value={replyTemplate}
          onChange={(event) => updateField("replyTemplate", event.target.value || undefined)}
          placeholder={"例如：\n{{#text#}}\n\n或者：\n你好，{{#accumulated.agent.answer#}}"}
        />
        <small className="section-copy">
          支持 `{"{{#path#}}"}` 模板语法。优先推荐把上游字段 mapping 到当前节点后直接写
          `{"{{#text#}}"}`；如果直接引用已有节点输出，可用
          `{"{{#accumulated.agent.answer#}}"}`、`{"{{#trigger_input.query#}}"}` 这类路径。
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

      <div className="binding-field compact-stack">
        <span className="binding-label">插入变量</span>
        <div className="tool-badge-row">
          {commonTokens.map((token) => (
            <button
              key={token}
              type="button"
              className="sync-button"
              onClick={() => insertReplyToken(token)}
            >
              {token}
            </button>
          ))}
        </div>
        <div className="tool-badge-row">
          {candidateNodes.length > 0 ? (
            candidateNodes.map((candidate) => {
              const basePath = `accumulated.${candidate.id}`;
              return (
                <React.Fragment key={candidate.id}>
                  <button
                    type="button"
                    className="sync-button"
                    onClick={() => insertReplyToken(formatReplyToken(basePath))}
                  >
                    {candidate.data.label} · {candidate.id}
                  </button>
                  <button
                    type="button"
                    className="sync-button"
                    onClick={() => insertReplyToken(formatReplyToken(`${basePath}.answer`))}
                  >
                    {formatReplyToken(`${basePath}.answer`)}
                  </button>
                </React.Fragment>
              );
            })
          ) : (
            <small className="section-copy">当前还没有可供回复模板引用的其他节点。</small>
          )}
        </div>
      </div>
    </div>
  );
}
