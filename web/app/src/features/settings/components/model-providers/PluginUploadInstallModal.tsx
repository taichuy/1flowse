import { Alert, Button, Modal, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';

export function PluginUploadInstallModal({
  open,
  submitting,
  resultSummary,
  errorMessage,
  fileList,
  onClose,
  onChange,
  onSubmit
}: {
  open: boolean;
  submitting: boolean;
  resultSummary: { displayName: string; version: string; trustLabel: string } | null;
  errorMessage: string | null;
  fileList: UploadFile[];
  onClose: () => void;
  onChange: (nextFiles: UploadFile[]) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      open={open}
      title="上传插件"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <div className="model-provider-panel__upload-modal">
        <Typography.Paragraph type="secondary">
          支持 `.1flowbasepkg`，兼容 `.tar.gz` / `.zip`。上传后仍由宿主后端统一验签和安装。
        </Typography.Paragraph>
        <Upload.Dragger
          beforeUpload={() => false}
          maxCount={1}
          fileList={fileList}
          onChange={({ fileList: nextFiles }) => onChange(nextFiles)}
        >
          选择插件包后上传并安装
        </Upload.Dragger>
        {resultSummary ? (
          <Alert
            type="success"
            showIcon
            message={`${resultSummary.displayName} ${resultSummary.version}`}
            description={`来源：手工上传；信任级别：${resultSummary.trustLabel}`}
          />
        ) : null}
        {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
        <Button type="primary" block loading={submitting} onClick={onSubmit}>
          上传并安装
        </Button>
      </div>
    </Modal>
  );
}
