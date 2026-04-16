import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';

interface ApplicationEditModalProps {
  open: boolean;
  application:
    | {
        name: string;
        description: string;
      }
    | null;
  saving?: boolean;
  onCancel: () => void;
  onSubmit: (values: { name: string; description: string }) => void;
}

export function ApplicationEditModal({
  open,
  application,
  saving = false,
  onCancel,
  onSubmit
}: ApplicationEditModalProps) {
  const [form] = Form.useForm<{ name: string; description: string }>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      name: application?.name ?? '',
      description: application?.description ?? ''
    });
  }, [application, form, open]);

  return (
    <Modal
      open={open}
      title="编辑应用信息"
      okText="保存修改"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
      forceRender
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          label="应用名称"
          name="name"
          rules={[{ required: true, message: '请输入应用名称' }]}
        >
          <Input maxLength={64} aria-label="应用名称" />
        </Form.Item>
        <Form.Item label="应用简介" name="description">
          <Input.TextArea rows={4} maxLength={240} aria-label="应用简介" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
