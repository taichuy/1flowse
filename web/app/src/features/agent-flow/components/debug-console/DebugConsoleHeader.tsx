import {
  ArrowLeftOutlined,
  CloseOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';

export function DebugConsoleHeader({
  mode,
  clearDisabled,
  onBackToPreview,
  onClear,
  onClose
}: {
  mode: 'preview' | 'trace';
  clearDisabled: boolean;
  onBackToPreview: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="agent-flow-editor__debug-console-header">
      <div className="agent-flow-editor__debug-console-title">
        <Space size={8}>
          {mode === 'trace' ? (
            <Button
              aria-label="返回预览"
              icon={<ArrowLeftOutlined />}
              size="small"
              type="text"
              onClick={onBackToPreview}
            />
          ) : null}
          <Typography.Text strong>{mode === 'trace' ? 'Trace 详情' : '预览'}</Typography.Text>
        </Space>
      </div>
      <Space size={4} wrap>
        <Button
          aria-label="清空预览"
          disabled={clearDisabled}
          icon={<ReloadOutlined />}
          size="small"
          type="text"
          onClick={onClear}
        />
        <Button
          aria-label="关闭预览"
          icon={<CloseOutlined />}
          size="small"
          type="text"
          onClick={onClose}
        />
      </Space>
    </div>
  );
}
