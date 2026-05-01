import {
  CopyOutlined,
  EyeOutlined,
  PartitionOutlined
} from '@ant-design/icons';
import { Button, Space } from 'antd';
import { useEffect, useState } from 'react';

import type { AgentFlowDebugMessage } from '../../../api/runtime';
import { DebugMarkdownContent } from './DebugMarkdownContent';
import { DebugWorkflowProcess } from './DebugWorkflowProcess';
import './debug-message.css';

function fallbackContent(message: AgentFlowDebugMessage) {
  if (message.status === 'running') {
    return '运行中...';
  }

  if (message.status === 'waiting_human') {
    return '等待人工介入。';
  }

  if (message.status === 'waiting_callback') {
    return '等待外部回调。';
  }

  if (message.status === 'cancelled') {
    return '已停止运行。';
  }

  if (message.status === 'failed') {
    return '调试运行失败。';
  }

  return '暂无输出。';
}

const TYPEWRITER_INTERVAL_MS = 24;
const TYPEWRITER_CHARS_PER_TICK = 12;

function useProgressiveText(target: string) {
  const [visibleText, setVisibleText] = useState(target);

  useEffect(() => {
    setVisibleText((currentText) => {
      if (!target) {
        return '';
      }

      if (!target.startsWith(currentText)) {
        return target;
      }

      return currentText;
    });
  }, [target]);

  useEffect(() => {
    if (visibleText.length >= target.length) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setVisibleText((currentText) =>
        target.slice(
          0,
          Math.min(target.length, currentText.length + TYPEWRITER_CHARS_PER_TICK)
        )
      );
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [target, visibleText]);

  return visibleText;
}

export function DebugAssistantMessage({
  message,
  onViewTrace
}: {
  message: AgentFlowDebugMessage;
  onViewTrace: () => void;
}) {
  const [showRawOutput, setShowRawOutput] = useState(false);
  const visibleContent = useProgressiveText(message.content);

  async function handleCopyOutput() {
    if (!message.content) {
      return;
    }

    await navigator.clipboard.writeText(message.content);
  }

  return (
    <article className="agent-flow-editor__debug-message agent-flow-editor__debug-message--assistant">
      <div className="agent-flow-editor__debug-message-main">
        <DebugWorkflowProcess
          items={message.traceSummary}
        />
        <DebugMarkdownContent
          className="agent-flow-editor__debug-message-content"
          content={message.content ? visibleContent : fallbackContent(message)}
        />
        <Space className="agent-flow-editor__debug-message-actions" size={8} wrap>
          <Button
            disabled={!message.content}
            icon={<CopyOutlined />}
            size="small"
            onClick={() => {
              void handleCopyOutput();
            }}
          >
            复制输出
          </Button>
          <Button
            disabled={message.traceSummary.length === 0}
            icon={<PartitionOutlined />}
            size="small"
            onClick={onViewTrace}
          >
            查看 Trace
          </Button>
          <Button
            disabled={!message.rawOutput}
            icon={<EyeOutlined />}
            size="small"
            onClick={() => setShowRawOutput((current) => !current)}
          >
            查看 Raw Output
          </Button>
        </Space>
        {showRawOutput && message.rawOutput ? (
          <pre className="agent-flow-editor__debug-raw-output">
            {JSON.stringify(message.rawOutput, null, 2)}
          </pre>
        ) : null}
      </div>
    </article>
  );
}
