"use client";

import React, { useEffect, useState } from "react";
import { Button, Input, Space, Typography } from "antd";

import {
  buildWorkflowEditorAssistantReply,
  createWorkflowEditorAssistantGreeting,
  type WorkflowEditorAssistantContext
} from "@/lib/workflow-editor-assistant";

const { Text } = Typography;
const { TextArea } = Input;

type WorkflowEditorAssistantMessage = {
  role: "assistant" | "user";
  content: string;
};

export type WorkflowEditorAssistantPanelProps = {
  assistantContext: WorkflowEditorAssistantContext;
};

export function WorkflowEditorAssistantPanel({
  assistantContext
}: WorkflowEditorAssistantPanelProps) {
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<WorkflowEditorAssistantMessage[]>([]);
  const [assistantCopyState, setAssistantCopyState] = useState<"idle" | "done">("idle");

  useEffect(() => {
    setAssistantDraft(assistantContext.promptSuggestions[0] ?? "");
    setAssistantMessages([
      {
        role: "assistant",
        content: createWorkflowEditorAssistantGreeting(assistantContext)
      }
    ]);
    setAssistantCopyState("idle");
  }, [assistantContext]);

  return (
    <Space
      orientation="vertical"
      size="large"
      style={{ width: "100%" }}
      data-component="workflow-editor-assistant-panel"
    >
      <div className="workflow-editor-assistant-hero">
        <div className="workflow-editor-assistant-hero-copy">
          <div className="workflow-editor-inspector-section-title">节点上下文</div>
          <Text type="secondary">
            先用当前节点、相邻连线和执行事实生成本地建议；后续再挂正式 assistant 接口。
          </Text>
        </div>
        <div className="workflow-editor-assistant-chip-list">
          <span className="workflow-editor-assistant-chip">{assistantContext.nodeType}</span>
          <span className="workflow-editor-assistant-chip">{assistantContext.executionClass}</span>
          <span className="workflow-editor-assistant-chip">
            schema {assistantContext.hasInputSchema || assistantContext.hasOutputSchema ? "ready" : "todo"}
          </span>
        </div>
      </div>

      <div className="workflow-editor-assistant-summary">
        <p>{assistantContext.summary}</p>
        <p>{assistantContext.topologyHint}</p>
        <p>{assistantContext.runtimeHint}</p>
      </div>

      <div className="workflow-editor-assistant-actions">
        {assistantContext.promptSuggestions.map((prompt) => (
          <Button key={prompt} size="small" onClick={() => setAssistantDraft(prompt)}>
            {prompt}
          </Button>
        ))}
        <Button
          size="small"
          type={assistantCopyState === "done" ? "primary" : "default"}
          onClick={async () => {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
              return;
            }

            await navigator.clipboard.writeText(assistantContext.contextPack);
            setAssistantCopyState("done");
          }}
        >
          {assistantCopyState === "done" ? "已复制上下文" : "复制节点上下文"}
        </Button>
      </div>

      <div className="workflow-editor-assistant-thread">
        {assistantMessages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`workflow-editor-assistant-message workflow-editor-assistant-message-${message.role}`}
          >
            <span className="workflow-editor-assistant-message-role">
              {message.role === "assistant" ? "AI" : "你"}
            </span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      <div className="workflow-editor-assistant-composer">
        <TextArea
          rows={4}
          value={assistantDraft}
          onChange={(event) => setAssistantDraft(event.target.value)}
          placeholder="例如：帮我检查这个节点怎么配，或者下一步接什么节点。"
        />
        <div className="workflow-editor-assistant-composer-actions">
          <Button
            type="primary"
            onClick={() => {
              const trimmedDraft = assistantDraft.trim();
              if (!trimmedDraft) {
                return;
              }

              setAssistantMessages((currentMessages) => [
                ...currentMessages,
                { role: "user", content: trimmedDraft },
                {
                  role: "assistant",
                  content: buildWorkflowEditorAssistantReply(assistantContext, trimmedDraft)
                }
              ]);
              setAssistantDraft("");
            }}
          >
            生成建议
          </Button>
          <Text type="secondary">仍留在当前面板，不新增 AI 侧栏。</Text>
        </div>
      </div>
    </Space>
  );
}
