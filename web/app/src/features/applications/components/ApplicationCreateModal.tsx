import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, Radio, Space, Typography } from 'antd';

import { SchemaModalPanel } from '../../../shared/schema-ui/overlay-shell/SchemaModalPanel';
import { applicationsQueryKey, createApplication } from '../api/applications';

interface ApplicationCreateModalProps {
  open: boolean;
  csrfToken: string;
  onClose: () => void;
  onCreated: (applicationId: string) => void;
}

interface ApplicationCreateFormValues {
  application_type: 'agent_flow' | 'workflow';
  name: string;
  description: string;
}

const applicationCreateShell = {
  schemaVersion: '1.0.0',
  shellType: 'modal_panel',
  title: '新建应用',
  destroyOnHidden: true
} as const;

export function ApplicationCreateModal({
  open,
  csrfToken,
  onClose,
  onCreated
}: ApplicationCreateModalProps) {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ApplicationCreateFormValues>();
  const mutation = useMutation({
    mutationFn: (values: ApplicationCreateFormValues) =>
      createApplication(
        {
          application_type: values.application_type,
          name: values.name,
          description: values.description,
          icon: 'RobotOutlined',
          icon_type: 'iconfont',
          icon_background: '#E6F7F2'
        },
        csrfToken
      ),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: applicationsQueryKey });
      form.resetFields();
      onClose();
      onCreated(created.id);
    }
  });

  return (
    <SchemaModalPanel open={open} schema={applicationCreateShell} onClose={onClose}>
      <Form<ApplicationCreateFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          application_type: 'agent_flow',
          name: '',
          description: ''
        }}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Form.Item label="类型" name="application_type">
          <Radio.Group>
            <Space direction="vertical" size="small">
              <Radio value="agent_flow">AgentFlow</Radio>
              <Radio value="workflow" disabled>
                Workflow
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Typography.Text type="secondary">未开放</Typography.Text>

        <Form.Item
          label="名称"
          name="name"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item label="简介" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          创建应用
        </Button>
      </Form>
    </SchemaModalPanel>
  );
}
