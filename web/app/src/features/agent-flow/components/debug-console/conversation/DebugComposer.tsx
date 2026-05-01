import { ArrowRightOutlined, ArrowUpOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Input, Typography } from 'antd';
import { useState } from 'react';

export function DebugComposer({
  value,
  disabled,
  submitting,
  onChange,
  onSubmit
}: {
  value: string;
  disabled: boolean;
  submitting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [isComposing, setIsComposing] = useState(false);

  return (
    <div className="agent-flow-editor__debug-composer">
      <div className="agent-flow-editor__debug-composer-box">
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 4 }}
          variant="borderless"
          placeholder="和 Bot 聊天"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(event) => {
            // 中文输入法组合态期间不能把 Enter 误判成发送。
            if (
              event.key !== 'Enter' ||
              event.shiftKey ||
              isComposing ||
              event.nativeEvent.isComposing
            ) {
              return;
            }

            event.preventDefault();

            if (disabled || submitting) {
              return;
            }

            onSubmit();
          }}
        />
        <div className="agent-flow-editor__debug-composer-actions">
          <Button
            aria-label="发送调试消息"
            className="agent-flow-editor__debug-composer-submit"
            disabled={disabled}
            icon={<ArrowUpOutlined />}
            loading={submitting}
            shape="circle"
            type="primary"
            onClick={onSubmit}
          />
        </div>
      </div>
      <div className="agent-flow-editor__debug-feature-bar">
        <span className="agent-flow-editor__debug-feature-icon">
          <MessageOutlined />
        </span>
        <Typography.Text>功能已开启</Typography.Text>
        <Button
          aria-label="管理功能"
          className="agent-flow-editor__debug-feature-manage"
          icon={<ArrowRightOutlined />}
          iconPosition="end"
          size="small"
          type="link"
        >
          管理
        </Button>
      </div>
    </div>
  );
}
