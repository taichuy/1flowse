import {
  CheckOutlined,
  CopyOutlined,
  DownOutlined,
  FullscreenOutlined
} from '@ant-design/icons';
import { Button, Card, Modal, Tooltip, message } from 'antd';
import { Suspense, lazy, useMemo, useState } from 'react';

import type { NodeLastRun } from '../../../api/runtime';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function formatJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}

function getRuntimeMetadata(lastRun: NodeLastRun) {
  const metrics = lastRun.node_run.metrics_payload ?? {};
  const errorPayload =
    lastRun.node_run.error_payload &&
    typeof lastRun.node_run.error_payload === 'object'
      ? lastRun.node_run.error_payload
      : {};

  return {
    created_by: lastRun.flow_run.created_by,
    compiled_plan_id: lastRun.flow_run.compiled_plan_id,
    output_contract_count: metrics.output_contract_count,
    provider_instance_id:
      (metrics.provider_instance_id as unknown) ??
      (errorPayload as Record<string, unknown>).provider_instance_id,
    provider_code:
      (metrics.provider_code as unknown) ??
      (errorPayload as Record<string, unknown>).provider_code,
    protocol:
      (metrics.protocol as unknown) ??
      (errorPayload as Record<string, unknown>).protocol,
    finish_reason:
      (metrics.finish_reason as unknown) ??
      (errorPayload as Record<string, unknown>).finish_reason
  };
}

function getOutputPayload(lastRun: NodeLastRun) {
  return {
    ...lastRun.node_run.output_payload,
    run_metadata: getRuntimeMetadata(lastRun)
  };
}

const EDITOR_OPTIONS = {
  readOnly: true,
  domReadOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  lineNumbersMinChars: 2,
  fontSize: 12,
  lineHeight: 18,
  folding: true,
  renderLineHighlight: 'none' as const,
  overviewRulerBorder: false,
  automaticLayout: true,
  padding: {
    top: 8,
    bottom: 8
  },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8
  }
};

function JsonEditorFallback() {
  return (
    <div className="agent-flow-node-run-json-viewer__loading">
      正在加载 JSON 查看器
    </div>
  );
}

function JsonEditor({ height, value }: { height: string; value: string }) {
  return (
    <Suspense fallback={<JsonEditorFallback />}>
      <MonacoEditor
        defaultLanguage="json"
        height={height}
        options={EDITOR_OPTIONS}
        theme="vs"
        value={value}
      />
    </Suspense>
  );
}

export function NodeRunJsonBlock({
  title,
  payload
}: {
  title: string;
  payload: Record<string, unknown>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const value = useMemo(() => formatJson(payload), [payload]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    message.success('已复制');
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="agent-flow-node-run-json-viewer">
      <pre aria-label={`${title} JSON`} className="agent-flow-node-run-json__a11y">
        {value}
      </pre>
      <div className="agent-flow-node-run-json-viewer__header">
        <button
          aria-label={title}
          aria-expanded={!collapsed}
          className="agent-flow-node-run-json-viewer__toggle"
          onClick={() => setCollapsed((current) => !current)}
          type="button"
        >
          <DownOutlined className="agent-flow-node-run-json-viewer__toggle-icon" />
          <span className="agent-flow-node-run-json-viewer__title">{title}</span>
        </button>
        <div className="agent-flow-node-run-json-viewer__actions">
          <Tooltip title="复制 JSON">
            <Button
              aria-label={`复制${title} JSON`}
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopy}
              size="small"
              type="text"
            />
          </Tooltip>
          <Tooltip title="放大查看">
            <Button
              aria-label={`放大查看${title} JSON`}
              disabled={collapsed}
              icon={<FullscreenOutlined />}
              onClick={() => setExpanded(true)}
              size="small"
              type="text"
            />
          </Tooltip>
        </div>
      </div>
      {!collapsed ? (
        <div className="agent-flow-node-run-json-viewer__editor">
          <JsonEditor height="220px" value={value} />
        </div>
      ) : null}
      <Modal
        centered
        className="agent-flow-node-run-json-modal"
        footer={null}
        onCancel={() => setExpanded(false)}
        open={expanded}
        title={`${title} JSON`}
        width="min(960px, calc(100vw - 48px))"
      >
        <div className="agent-flow-node-run-json-modal__editor">
          <JsonEditor height="70vh" value={value} />
        </div>
      </Modal>
    </section>
  );
}

export function NodeRunIOCard({
  lastRun
}: {
  lastRun: NodeLastRun;
}) {
  return (
    <Card title="节点输入输出">
      <div className="agent-flow-node-run-json-list">
        <NodeRunJsonBlock payload={lastRun.node_run.input_payload} title="输入" />
        <NodeRunJsonBlock payload={getOutputPayload(lastRun)} title="输出" />
      </div>
    </Card>
  );
}
