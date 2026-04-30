import { useEffect, useState } from 'react';

import { Button, Checkbox, Drawer, Form, Input, Modal, Select, Space } from 'antd';

import type {
  CreateSettingsDataModelFieldInput,
  SettingsDataModel,
  SettingsDataModelField,
  UpdateSettingsDataModelFieldInput
} from '../../api/data-models';

const fieldKindOptions = [
  'string',
  'number',
  'boolean',
  'datetime',
  'enum',
  'text',
  'json',
  'many_to_one',
  'one_to_many',
  'many_to_many'
].map((value) => ({ label: value, value }));

const displayInterfaceOptions = [
  { label: 'input', value: 'input' },
  { label: 'textarea', value: 'textarea' },
  { label: 'select', value: 'select' },
  { label: 'switch', value: 'switch' },
  { label: 'date_picker', value: 'date_picker' },
  { label: 'json_editor', value: 'json_editor' }
];

interface FieldFormValues {
  code: string;
  title: string;
  external_field_key?: string;
  field_kind: string;
  is_required: boolean;
  is_unique: boolean;
  default_value_json: string;
  display_interface: string | null;
  display_options_json: string;
  relation_target_model_id: string | null;
  relation_options_json: string;
}

function stringifyJson(value: unknown, fallback = '{}') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return JSON.stringify(value, null, 2);
}

function parseJson(raw: string, fallback: unknown) {
  const trimmed = (raw ?? '').trim();

  if (!trimmed) {
    return fallback;
  }

  return JSON.parse(trimmed) as unknown;
}

export function DataModelFieldDrawer({
  open,
  mode,
  field,
  modelOptions,
  saving,
  canManage,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}: {
  open: boolean;
  mode: 'create' | 'edit';
  field: SettingsDataModelField | null;
  modelOptions: SettingsDataModel[];
  saving: boolean;
  canManage: boolean;
  onClose: () => void;
  onCreate: (input: CreateSettingsDataModelFieldInput) => void;
  onUpdate: (
    field: SettingsDataModelField,
    input: UpdateSettingsDataModelFieldInput
  ) => void;
  onDelete: (field: SettingsDataModelField) => void;
}) {
  const [form] = Form.useForm<FieldFormValues>();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && field) {
      form.setFieldsValue({
        code: field.code,
        title: field.title,
        external_field_key: field.external_field_key ?? '',
        field_kind: field.field_kind,
        is_required: field.is_required,
        is_unique: field.is_unique,
        default_value_json: stringifyJson(field.default_value, ''),
        display_interface: field.display_interface ?? 'input',
        display_options_json: stringifyJson(field.display_options),
        relation_target_model_id: field.relation_target_model_id,
        relation_options_json: stringifyJson(field.relation_options)
      });
      return;
    }

    form.setFieldsValue({
      code: '',
      title: '',
      external_field_key: '',
      field_kind: 'string',
      is_required: false,
      is_unique: false,
      default_value_json: '',
      display_interface: 'input',
      display_options_json: '{}',
      relation_target_model_id: null,
      relation_options_json: '{}'
    });
  }, [field, form, mode, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    let defaultValue: unknown | null = null;
    let displayOptions: Record<string, unknown> = {};
    let relationOptions: Record<string, unknown> = {};

    try {
      defaultValue = parseJson(values.default_value_json, null) as unknown | null;
    } catch {
      form.setFields([
        {
          name: 'default_value_json',
          errors: ['请输入合法 JSON']
        }
      ]);
      return;
    }

    try {
      displayOptions = parseJson(
        values.display_options_json,
        {}
      ) as Record<string, unknown>;
    } catch {
      form.setFields([
        {
          name: 'display_options_json',
          errors: ['请输入合法 JSON']
        }
      ]);
      return;
    }

    try {
      relationOptions = parseJson(
        values.relation_options_json,
        {}
      ) as Record<string, unknown>;
    } catch {
      form.setFields([
        {
          name: 'relation_options_json',
          errors: ['请输入合法 JSON']
        }
      ]);
      return;
    }

    if (mode === 'edit' && field) {
      onUpdate(field, {
        title: values.title,
        is_required: values.is_required,
        is_unique: values.is_unique,
        default_value: defaultValue,
        display_interface: values.display_interface || null,
        display_options: displayOptions,
        relation_options: relationOptions
      });
      onClose();
      return;
    }

    onCreate({
      code: values.code,
      title: values.title,
      external_field_key: values.external_field_key || null,
      field_kind: values.field_kind,
      is_required: values.is_required,
      is_unique: values.is_unique,
      default_value: defaultValue,
      display_interface: values.display_interface || null,
      display_options: displayOptions,
      relation_target_model_id: values.relation_target_model_id || null,
      relation_options: relationOptions
    });
    onClose();
  };

  const confirmDelete = () => {
    if (!field) {
      return;
    }

    setDeleteConfirmOpen(true);
  };

  const relationTargetOptions = modelOptions.map((model) => ({
    label: `${model.title} (${model.code})`,
    value: model.id
  }));

  return (
    <>
      <Drawer
        title={mode === 'create' ? '新增字段' : '编辑字段'}
        open={open}
        width={560}
        onClose={onClose}
        extra={
          <Space>
            {mode === 'edit' ? (
              <Button danger disabled={!canManage || saving} onClick={confirmDelete}>
                删除字段
              </Button>
            ) : null}
            <Button
              type="primary"
              loading={saving}
              disabled={!canManage}
              onClick={handleSubmit}
            >
              {mode === 'create' ? '创建字段' : '保存字段'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          disabled={!canManage}
          initialValues={{
            field_kind: 'string',
            is_required: false,
            is_unique: false,
            display_interface: 'input',
            display_options_json: '{}',
            relation_options_json: '{}'
          }}
        >
          <Form.Item
            name="code"
            label="字段 Code"
            rules={[{ required: true, message: '请输入字段 Code' }]}
          >
            <Input disabled={mode === 'edit'} />
          </Form.Item>
          <Form.Item
            name="title"
            label="字段标题"
            rules={[{ required: true, message: '请输入字段标题' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="external_field_key" label="外部字段 Key">
            <Input disabled={mode === 'edit'} />
          </Form.Item>
          <Form.Item
            name="field_kind"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select options={fieldKindOptions} disabled={mode === 'edit'} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="is_required" valuePropName="checked">
              <Checkbox>必填</Checkbox>
            </Form.Item>
            <Form.Item name="is_unique" valuePropName="checked">
              <Checkbox>唯一</Checkbox>
            </Form.Item>
          </Space>
          <Form.Item name="default_value_json" label="默认值 JSON">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="display_interface" label="Display interface">
            <Select allowClear options={displayInterfaceOptions} />
          </Form.Item>
          <Form.Item name="display_options_json" label="Display options JSON">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="relation_target_model_id" label="Relation target">
            <Select
              allowClear
              disabled={mode === 'edit'}
              options={relationTargetOptions}
            />
          </Form.Item>
          <Form.Item name="relation_options_json" label="Relation options JSON">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>
      <Modal
        title="确认删除字段"
        open={deleteConfirmOpen}
        okText="删除"
        okType="danger"
        cancelText="取消"
        okButtonProps={{ 'aria-label': '删除' }}
        onCancel={() => setDeleteConfirmOpen(false)}
        onOk={() => {
          if (field) {
            onDelete(field);
          }
          setDeleteConfirmOpen(false);
          onClose();
        }}
      >
        {field
          ? `确定删除字段 "${field.title}" (${field.code}) 吗？此操作会同步变更数据结构。`
          : null}
      </Modal>
    </>
  );
}
