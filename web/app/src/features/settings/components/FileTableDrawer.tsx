import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  message,
  Select
} from 'antd';
import {
  createSettingsFileTable,
  type SettingsFileStorage,
  type SettingsFileTable
} from '../api/file-management';
import { useAuthStore } from '../../../state/auth-store';

type DrawerMode = 'create' | 'view' | 'edit';

interface FileTableDrawerProps {
  open: boolean;
  mode: DrawerMode;
  record: SettingsFileTable | null;
  storages: SettingsFileStorage[];
  onClose: () => void;
  onSuccess: () => void;
  onUpdateBinding: (tableId: string, storageId: string) => Promise<void>;
}

interface TableFormValues {
  code: string;
  title: string;
  bound_storage_id: string;
}

export function FileTableDrawer({
  open,
  mode,
  record,
  storages,
  onClose,
  onSuccess,
  onUpdateBinding
}: FileTableDrawerProps) {
  const [form] = Form.useForm<TableFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [bindingSubmitting, setBindingSubmitting] = useState(false);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const isView = mode === 'view';

  useEffect(() => {
    if (open) {
      if (record && mode !== 'create') {
        form.setFieldsValue({
          code: record.code,
          title: record.title,
          bound_storage_id: record.bound_storage_id || ''
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

      await createSettingsFileTable(
        { code: values.code, title: values.title },
        csrfToken
      );

      message.success('文件表已创建');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg =
        err instanceof Error ? err.message : '创建失败，请重试';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBindingSave = async () => {
    if (!record) return;
    try {
      const values = form.getFieldsValue();
      setBindingSubmitting(true);
      await onUpdateBinding(record.id, values.bound_storage_id || '');
      message.success('绑定已更新');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '更新绑定失败，请重试';
      message.error(msg);
    } finally {
      setBindingSubmitting(false);
    }
  };

  const storageOptions = storages.map((s) => ({
    label: `${s.title} (${s.code})`,
    value: s.id
  }));

  return (
    <Drawer
      title={
        mode === 'create'
          ? '新增文件表'
          : mode === 'edit'
            ? '编辑文件表'
            : '查看文件表'
      }
      open={open}
      onClose={onClose}
      width={480}
      extra={
        !isView ? (
          mode === 'edit' ? (
            <Button
              type="primary"
              loading={bindingSubmitting}
              onClick={handleBindingSave}
            >
              保存绑定
            </Button>
          ) : (
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              创建
            </Button>
          )
        ) : undefined
      }
    >
      <Form
        form={form}
        layout="vertical"
        disabled={isView}
        initialValues={{ bound_storage_id: '' }}
      >
        <Form.Item
          name="code"
          label="表标识"
          rules={[{ required: true, message: '请输入文件表标识' }]}
        >
          <Input placeholder="例: attachments" disabled={mode !== 'create'} />
        </Form.Item>

        <Form.Item
          name="title"
          label="名称"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="例: 附件表" disabled={isView} />
        </Form.Item>

        {mode !== 'create' && (
          <>
            <Form.Item
              name="bound_storage_id"
              label="绑定存储"
              rules={[{ required: true, message: '请选择一个存储' }]}
            >
              <Select
                options={storageOptions}
                placeholder="选择存储空间"
                allowClear
                disabled={isView}
              />
            </Form.Item>

            <Form.Item label="作用域">
              <Input
                value={
                  record
                    ? `${record.scope_kind} / ${record.scope_id}`
                    : '-'
                }
                disabled
              />
            </Form.Item>

            {record && (
              <>
                <Form.Item label="内置表">
                  <Input value={record.is_builtin ? '是' : '否'} disabled />
                </Form.Item>
                <Form.Item label="状态">
                  <Input value={record.status} disabled />
                </Form.Item>
              </>
            )}
          </>
        )}
      </Form>

      {mode === 'edit' && record && !isView && (
        <div style={{ marginTop: 16, color: '#888', fontSize: 13 }}>
          提示：编辑模式下仅可修改存储绑定。表标识和名称在创建后不可更改。
        </div>
      )}
    </Drawer>
  );
}
