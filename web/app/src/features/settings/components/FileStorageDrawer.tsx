import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Switch
} from 'antd';
import {
  createSettingsFileStorage,
  updateSettingsFileStorage,
  type SettingsFileStorage,
  type CreateSettingsFileStorageInput,
  type UpdateSettingsFileStorageInput
} from '../api/file-management';
import { useAuthStore } from '../../../state/auth-store';

type DrawerMode = 'create' | 'view' | 'edit';

interface FileStorageDrawerProps {
  open: boolean;
  mode: DrawerMode;
  record: SettingsFileStorage | null;
  onClose: () => void;
  onSuccess: () => void;
}

type StorageFormScalar = string | number | boolean | undefined;
type StorageFormObject = Record<string, StorageFormScalar>;

interface StorageFormValues {
  code: string;
  title: string;
  driver_type: string;
  enabled: boolean;
  is_default: boolean;
  config_json: StorageFormObject;
  rule_json: StorageFormObject;
}

const DRIVER_TYPE_OPTIONS = [
  { label: '本地文件系统 (Local)', value: 'local' },
  { label: 'AWS S3 / 兼容 (S3)', value: 's3' },
  { label: '阿里云 OSS', value: 'oss' },
  { label: '腾讯云 COS', value: 'cos' },
  { label: '通用 S3 兼容 (RustFS)', value: 'rustfs' }
];

const DRIVER_FIELDS: Record<string, { key: string; label: string; type: 'string' | 'number' }[]> = {
  local: [
    { key: 'root_path', label: '根目录路径', type: 'string' }
  ],
  s3: [
    { key: 'endpoint', label: 'Endpoint', type: 'string' },
    { key: 'region', label: 'Region', type: 'string' },
    { key: 'bucket', label: 'Bucket', type: 'string' },
    { key: 'access_key_id', label: 'Access Key ID', type: 'string' },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'string' },
    { key: 'force_path_style', label: 'Force Path Style', type: 'string' }
  ],
  oss: [
    { key: 'endpoint', label: 'Endpoint', type: 'string' },
    { key: 'region', label: 'Region', type: 'string' },
    { key: 'bucket', label: 'Bucket', type: 'string' },
    { key: 'access_key_id', label: 'Access Key ID', type: 'string' },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'string' }
  ],
  cos: [
    { key: 'endpoint', label: 'Endpoint', type: 'string' },
    { key: 'region', label: 'Region', type: 'string' },
    { key: 'bucket', label: 'Bucket', type: 'string' },
    { key: 'access_key_id', label: 'Access Key ID', type: 'string' },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'string' }
  ],
  rustfs: [
    { key: 'endpoint', label: 'Endpoint', type: 'string' },
    { key: 'region', label: 'Region', type: 'string' },
    { key: 'bucket', label: 'Bucket', type: 'string' },
    { key: 'access_key_id', label: 'Access Key ID', type: 'string' },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'string' },
    { key: 'force_path_style', label: 'Force Path Style', type: 'string' }
  ]
};

function toStorageFormObject(
  value: Record<string, unknown> | null | undefined
): StorageFormObject {
  return (value ?? {}) as StorageFormObject;
}

export function FileStorageDrawer({
  open,
  mode,
  record,
  onClose,
  onSuccess
}: FileStorageDrawerProps) {
  const [form] = Form.useForm<StorageFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const isView = mode === 'view';

  useEffect(() => {
    if (open) {
      if (record && mode !== 'create') {
        form.setFieldsValue({
          code: record.code,
          title: record.title,
          driver_type: record.driver_type,
          enabled: record.enabled,
          is_default: record.is_default,
          config_json: toStorageFormObject(record.config_json),
          rule_json: toStorageFormObject(record.rule_json)
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, record, mode, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      const input: CreateSettingsFileStorageInput = {
        code: values.code,
        title: values.title,
        driver_type: values.driver_type,
        enabled: values.enabled,
        is_default: values.is_default,
        config_json: values.config_json ?? {},
        rule_json: values.rule_json ?? {}
      };

      if (mode === 'edit' && record) {
        const updateInput: UpdateSettingsFileStorageInput = {
          title: input.title,
          enabled: input.enabled,
          is_default: input.is_default,
          config_json: input.config_json,
          rule_json: input.rule_json
        };
        await updateSettingsFileStorage(record.id, updateInput, csrfToken);
        message.success('存储配置已更新');
      } else {
        await createSettingsFileStorage(input, csrfToken);
        message.success('存储配置已创建');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg =
        err instanceof Error ? err.message : '操作失败，请重试';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const currentDriver = Form.useWatch('driver_type', form);

  return (
    <Drawer
      title={
        mode === 'create'
          ? '新增存储配置'
          : mode === 'edit'
            ? '编辑存储配置'
            : '查看存储配置'
      }
      open={open}
      onClose={onClose}
      width={520}
      extra={
        !isView ? (
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            {mode === 'create' ? '创建' : '保存'}
          </Button>
        ) : undefined
      }
    >
      <Form
        form={form}
        layout="vertical"
        disabled={isView}
        initialValues={{
          driver_type: 'local',
          enabled: true,
          is_default: false,
          config_json: {},
          rule_json: {}
        }}
      >
        <Form.Item
          name="code"
          label="存储标识"
          rules={[{ required: true, message: '请输入存储标识' }]}
        >
          <Input placeholder="例: local-storage" disabled={mode === 'edit' || isView} />
        </Form.Item>

        <Form.Item
          name="title"
          label="名称"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="例: 本地存储" />
        </Form.Item>

        <Form.Item
          name="driver_type"
          label="驱动类型"
          rules={[{ required: true, message: '请选择驱动类型' }]}
        >
          <Select options={DRIVER_TYPE_OPTIONS} disabled={mode === 'edit' || isView} />
        </Form.Item>

        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="is_default" label="设为默认存储" valuePropName="checked">
          <Switch />
        </Form.Item>

        {currentDriver && DRIVER_FIELDS[currentDriver] && (
          <div className="storage-drawer-driver-config">
            <h4>驱动配置</h4>
            {DRIVER_FIELDS[currentDriver].map((field) => (
              <Form.Item
                key={field.key}
                name={['config_json', field.key]}
                label={field.label}
              >
                {field.type === 'number' ? (
                  <InputNumber style={{ width: '100%' }} />
                ) : (
                  <Input placeholder={`请输入${field.label}`} />
                )}
              </Form.Item>
            ))}
          </div>
        )}

        <Form.Item name={['rule_json', 'description']} label="规则描述">
          <Input.TextArea rows={2} placeholder="可选" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
