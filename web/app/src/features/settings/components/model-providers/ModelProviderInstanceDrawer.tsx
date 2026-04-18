import { useEffect } from 'react';

import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Space,
  Switch,
  Tag,
  Typography
} from 'antd';

import type {
  SettingsModelProviderCatalogEntry,
  SettingsModelProviderInstance
} from '../../api/model-providers';

type DrawerMode = 'create' | 'edit';
type ModelProviderFormValue = string | boolean;

function normalizeConfigFieldValue(value: unknown): ModelProviderFormValue {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function buildInitialConfig(
  entry: SettingsModelProviderCatalogEntry | null,
  instance: SettingsModelProviderInstance | null
) {
  const currentConfig = instance?.config_json ?? {};
  const nextConfig: Record<string, ModelProviderFormValue> = {};

  for (const field of entry?.form_schema ?? []) {
    const currentValue = currentConfig[field.key];

    if (currentValue !== undefined) {
      nextConfig[field.key] = normalizeConfigFieldValue(currentValue);
      continue;
    }

    if (field.field_type === 'boolean') {
      nextConfig[field.key] = field.key === 'validate_model';
      continue;
    }

    if (field.key === 'base_url' && entry?.default_base_url) {
      nextConfig[field.key] = entry.default_base_url;
      continue;
    }

    nextConfig[field.key] = '';
  }

  return nextConfig;
}

function renderConfigField(
  mode: DrawerMode,
  entry: SettingsModelProviderCatalogEntry,
  field: SettingsModelProviderCatalogEntry['form_schema'][number]
) {
  if (field.field_type === 'boolean') {
    return (
      <Form.Item
        key={field.key}
        label={field.key}
        name={['config', field.key]}
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
    );
  }

  const isSecret = field.field_type === 'secret';
  const useTextArea =
    field.key.includes('headers') || field.key.includes('json') || field.key.includes('schema');

  return (
    <Form.Item
      key={field.key}
      label={field.key}
      name={['config', field.key]}
      rules={
        field.required && (!isSecret || mode === 'create')
          ? [{ required: true, message: `请填写 ${field.key}` }]
          : undefined
      }
      extra={
        isSecret && mode === 'edit' ? '留空表示保留当前 secret，不会覆盖。' : undefined
      }
    >
      {isSecret ? (
        <Input.Password placeholder="输入新的 secret" />
      ) : useTextArea ? (
        <Input.TextArea rows={4} placeholder={field.key === 'base_url' ? entry.default_base_url ?? '' : undefined} />
      ) : (
        <Input placeholder={field.key === 'base_url' ? entry.default_base_url ?? '' : undefined} />
      )}
    </Form.Item>
  );
}

export function ModelProviderInstanceDrawer({
  open,
  mode,
  catalogEntry,
  instance,
  submitting,
  onClose,
  onSubmit
}: {
  open: boolean;
  mode: DrawerMode;
  catalogEntry: SettingsModelProviderCatalogEntry | null;
  instance: SettingsModelProviderInstance | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: { display_name: string; config: Record<string, unknown> }) => Promise<void>;
}) {
  const [form] = Form.useForm<{
    display_name: string;
    config: Record<string, ModelProviderFormValue>;
  }>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      display_name: instance?.display_name ?? catalogEntry?.display_name ?? '',
      config: buildInitialConfig(catalogEntry, instance)
    });
  }, [catalogEntry, form, instance, open]);

  const title = mode === 'create' ? '新建模型供应商实例' : '编辑模型供应商实例';

  return (
    <Drawer
      open={open}
      width={520}
      forceRender
      title={title}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={async () => {
              const values = await form.validateFields();
              await onSubmit({
                display_name: values.display_name,
                config: values.config
              });
            }}
          >
            保存实例
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        {catalogEntry ? (
          <>
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'provider',
                  label: 'Provider',
                  children: `${catalogEntry.display_name} (${catalogEntry.provider_code})`
                },
                {
                  key: 'protocol',
                  label: 'Protocol',
                  children: (
                    <Space wrap size={6}>
                      <Tag>{catalogEntry.protocol}</Tag>
                      <Tag>{catalogEntry.model_discovery_mode}</Tag>
                    </Space>
                  )
                },
                {
                  key: 'models',
                  label: '预置模型',
                  children: String(catalogEntry.predefined_models.length)
                }
              ]}
            />

            <Typography.Paragraph
              type="secondary"
              className="model-provider-panel__drawer-note"
            >
              普通配置会进入实例元数据；secret 字段只会加密存储，不会回显到列表响应。
            </Typography.Paragraph>

            <Form.Item
              label="实例名称"
              name="display_name"
              rules={[{ required: true, message: '请填写实例名称' }]}
            >
              <Input />
            </Form.Item>

            {catalogEntry.form_schema.map((field) =>
              renderConfigField(mode, catalogEntry, field)
            )}
          </>
        ) : (
          <Typography.Text type="secondary">当前没有可用 provider catalog。</Typography.Text>
        )}
      </Form>
    </Drawer>
  );
}
