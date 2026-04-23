import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { useAuthStore } from '../../../state/auth-store';
import {
  createSettingsFileStorage,
  createSettingsFileTable,
  fetchSettingsFileStorages,
  fetchSettingsFileTables,
  settingsFileStoragesQueryKey,
  settingsFileTablesQueryKey,
  updateSettingsFileTableBinding,
  type CreateSettingsFileStorageInput,
  type SettingsFileStorage,
  type SettingsFileTable
} from '../api/file-management';
import './file-management-panel.css';

type StorageFormValues = {
  code: string;
  title: string;
  driver_type: 'local' | 'rustfs';
  enabled: boolean;
  is_default: boolean;
  root_path?: string;
  endpoint?: string;
  bucket?: string;
  access_key?: string;
  secret_key?: string;
  region?: string;
  force_path_style?: boolean;
  public_base_url?: string;
};

type TableFormValues = {
  code: string;
  title: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function compactString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildStorageInput(
  values: StorageFormValues
): CreateSettingsFileStorageInput {
  if (values.driver_type === 'local') {
    return {
      code: values.code.trim(),
      title: values.title.trim(),
      driver_type: values.driver_type,
      enabled: values.enabled,
      is_default: values.is_default,
      config_json: {
        root_path: values.root_path?.trim() ?? '',
        ...(compactString(values.public_base_url)
          ? { public_base_url: values.public_base_url!.trim() }
          : {})
      },
      rule_json: {}
    };
  }

  return {
    code: values.code.trim(),
    title: values.title.trim(),
    driver_type: values.driver_type,
    enabled: values.enabled,
    is_default: values.is_default,
    config_json: {
      endpoint: values.endpoint?.trim() ?? '',
      bucket: values.bucket?.trim() ?? '',
      access_key: values.access_key?.trim() ?? '',
      secret_key: values.secret_key?.trim() ?? '',
      ...(compactString(values.region) ? { region: values.region!.trim() } : {}),
      force_path_style: values.force_path_style ?? true,
      ...(compactString(values.public_base_url)
        ? { public_base_url: values.public_base_url!.trim() }
        : {})
    },
    rule_json: {}
  };
}

function describeStorageLocation(storage: SettingsFileStorage) {
  if (storage.driver_type === 'local') {
    return compactString(storage.config_json.root_path) ?? '未配置根目录';
  }

  if (storage.driver_type === 'rustfs') {
    const bucket = compactString(storage.config_json.bucket) ?? 'unknown-bucket';
    const endpoint = compactString(storage.config_json.endpoint) ?? 'unknown-endpoint';

    return `${bucket} @ ${endpoint}`;
  }

  return storage.driver_type;
}

function renderHealthTag(status: string) {
  switch (status) {
    case 'ready':
      return <Tag color="green">Ready</Tag>;
    case 'failed':
      return <Tag color="red">Failed</Tag>;
    default:
      return <Tag>Unknown</Tag>;
  }
}

function renderScopeTag(scopeKind: string) {
  switch (scopeKind) {
    case 'system':
      return <Tag color="gold">System</Tag>;
    case 'workspace':
      return <Tag color="blue">Workspace</Tag>;
    default:
      return <Tag>{scopeKind}</Tag>;
  }
}

function buildBindingDrafts(tables: SettingsFileTable[]) {
  return Object.fromEntries(
    tables.map((table) => [table.id, table.bound_storage_id])
  );
}

export function FileManagementPanel({
  isRoot,
  canViewTables,
  canCreateTables
}: {
  isRoot: boolean;
  canViewTables: boolean;
  canCreateTables: boolean;
}) {
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [storageForm] = Form.useForm<StorageFormValues>();
  const [tableForm] = Form.useForm<TableFormValues>();
  const [bindingDrafts, setBindingDrafts] = useState<Record<string, string>>({});

  const storagesQuery = useQuery({
    queryKey: settingsFileStoragesQueryKey,
    queryFn: fetchSettingsFileStorages,
    enabled: isRoot
  });
  const tablesQuery = useQuery({
    queryKey: settingsFileTablesQueryKey,
    queryFn: fetchSettingsFileTables,
    enabled: canViewTables
  });

  useEffect(() => {
    if (!isRoot) {
      return;
    }

    storageForm.setFieldsValue({
      driver_type: 'local',
      enabled: true,
      is_default: false,
      force_path_style: true
    });
  }, [isRoot, storageForm]);

  useEffect(() => {
    if (!tablesQuery.data) {
      return;
    }

    setBindingDrafts((current) => ({
      ...buildBindingDrafts(tablesQuery.data),
      ...current
    }));
  }, [tablesQuery.data]);

  const storages = storagesQuery.data ?? [];
  const tables = tablesQuery.data ?? [];
  const storageMap = useMemo(
    () => new Map(storages.map((storage) => [storage.id, storage])),
    [storages]
  );
  const storageOptions = useMemo(
    () =>
      storages.map((storage) => ({
        label: `${storage.title} (${storage.code})`,
        value: storage.id
      })),
    [storages]
  );

  const invalidateStorages = () =>
    queryClient.invalidateQueries({ queryKey: settingsFileStoragesQueryKey });
  const invalidateTables = () =>
    queryClient.invalidateQueries({ queryKey: settingsFileTablesQueryKey });

  const createStorageMutation = useMutation({
    mutationFn: async (values: StorageFormValues) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return createSettingsFileStorage(buildStorageInput(values), csrfToken);
    },
    onSuccess: async () => {
      messageApi.success('存储已创建');
      storageForm.resetFields();
      storageForm.setFieldsValue({
        driver_type: 'local',
        enabled: true,
        is_default: false,
        force_path_style: true
      });
      await invalidateStorages();
    }
  });

  const createTableMutation = useMutation({
    mutationFn: async (values: TableFormValues) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return createSettingsFileTable(
        {
          code: values.code.trim(),
          title: values.title.trim()
        },
        csrfToken
      );
    },
    onSuccess: async () => {
      messageApi.success('文件表已创建');
      tableForm.resetFields();
      if (canViewTables) {
        await invalidateTables();
      }
    }
  });

  const bindStorageMutation = useMutation({
    mutationFn: async ({
      fileTableId,
      boundStorageId
    }: {
      fileTableId: string;
      boundStorageId: string;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return updateSettingsFileTableBinding(
        fileTableId,
        { bound_storage_id: boundStorageId },
        csrfToken
      );
    },
    onSuccess: async () => {
      messageApi.success('文件表绑定已更新');
      await invalidateTables();
    }
  });

  const errorMessage =
    getErrorMessage(storagesQuery.error) ??
    getErrorMessage(tablesQuery.error) ??
    getErrorMessage(createStorageMutation.error) ??
    getErrorMessage(createTableMutation.error) ??
    getErrorMessage(bindStorageMutation.error);

  const storageColumns = useMemo<ColumnsType<SettingsFileStorage>>(
    () => [
      {
        title: '存储',
        key: 'storage',
        render: (_value, storage) => (
          <div className="file-management-panel__entity">
            <Typography.Text strong>{storage.title}</Typography.Text>
            <Typography.Text type="secondary">
              {storage.code}
            </Typography.Text>
          </div>
        )
      },
      {
        title: '驱动与位置',
        key: 'driver',
        render: (_value, storage) => (
          <div className="file-management-panel__entity">
            <Space wrap size={8}>
              <Tag>{storage.driver_type}</Tag>
              {storage.is_default ? <Tag color="green">默认</Tag> : null}
              {!storage.enabled ? <Tag color="default">停用</Tag> : null}
            </Space>
            <Typography.Text type="secondary">
              {describeStorageLocation(storage)}
            </Typography.Text>
          </div>
        )
      },
      {
        title: '健康状态',
        key: 'health',
        width: 180,
        render: (_value, storage) => (
          <div className="file-management-panel__entity">
            {renderHealthTag(storage.health_status)}
            {storage.last_health_error ? (
              <Typography.Text type="danger">
                {storage.last_health_error}
              </Typography.Text>
            ) : null}
          </div>
        )
      }
    ],
    []
  );

  const tableColumns = useMemo<ColumnsType<SettingsFileTable>>(
    () => [
      {
        title: '文件表',
        key: 'table',
        render: (_value, table) => (
          <div className="file-management-panel__entity">
            <Space wrap size={8}>
              <Typography.Text strong>{table.title}</Typography.Text>
              {table.is_builtin ? <Tag color="gold">内建</Tag> : null}
              {table.is_default ? <Tag color="green">默认</Tag> : null}
            </Space>
            <Typography.Text type="secondary">
              {table.code}
            </Typography.Text>
          </div>
        )
      },
      {
        title: '范围',
        dataIndex: 'scope_kind',
        key: 'scope_kind',
        width: 140,
        render: (scopeKind: string) => renderScopeTag(scopeKind)
      },
      {
        title: '当前绑定',
        key: 'binding',
        render: (_value, table) => {
          const fallbackStorage = storageMap.get(table.bound_storage_id);
          const label =
            table.bound_storage_title ??
            fallbackStorage?.title ??
            table.bound_storage_id;

          return (
            <div className="file-management-panel__entity">
              <Typography.Text strong>{label}</Typography.Text>
              <Typography.Text type="secondary">
                {table.bound_storage_id}
              </Typography.Text>
            </div>
          );
        }
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: string) => <Tag color="blue">{status}</Tag>
      },
      ...(isRoot
        ? [
            {
              title: '绑定操作',
              key: 'actions',
              width: 260,
              render: (_value: unknown, table: SettingsFileTable) => (
                <div className="file-management-panel__action-stack">
                  <Select
                    options={storageOptions}
                    value={bindingDrafts[table.id] ?? table.bound_storage_id}
                    onChange={(value) =>
                      setBindingDrafts((current) => ({
                        ...current,
                        [table.id]: value
                      }))
                    }
                  />
                  <Button
                    onClick={() =>
                      bindStorageMutation.mutate({
                        fileTableId: table.id,
                        boundStorageId:
                          bindingDrafts[table.id] ?? table.bound_storage_id
                      })
                    }
                    loading={
                      bindStorageMutation.isPending &&
                      bindStorageMutation.variables?.fileTableId === table.id
                    }
                    disabled={
                      !storageOptions.length ||
                      (bindingDrafts[table.id] ?? table.bound_storage_id) ===
                        table.bound_storage_id
                    }
                  >
                    保存绑定
                  </Button>
                </div>
              )
            }
          ]
        : [])
    ],
    [bindingDrafts, bindStorageMutation, isRoot, storageMap, storageOptions]
  );

  return (
    <div className="file-management-panel">
      {messageContextHolder}

      <div className="file-management-panel__header">
        <Typography.Title level={4}>文件管理</Typography.Title>
        <Typography.Paragraph type="secondary">
          统一维护文件存储、工作区文件表和当前绑定关系。Root
          负责存储与绑定，工作区角色只暴露文件表能力。
        </Typography.Paragraph>
      </div>

      {errorMessage ? (
        <Alert type="error" showIcon message={errorMessage} />
      ) : null}

      <div className="file-management-panel__summary">
        <div className="file-management-panel__summary-item">
          <Typography.Text type="secondary">可用存储</Typography.Text>
          <Typography.Title level={3}>{isRoot ? storages.length : '-'}</Typography.Title>
        </div>
        <div className="file-management-panel__summary-item">
          <Typography.Text type="secondary">文件表数量</Typography.Text>
          <Typography.Title level={3}>
            {canViewTables ? tables.length : '-'}
          </Typography.Title>
        </div>
        <div className="file-management-panel__summary-item">
          <Typography.Text type="secondary">当前默认存储</Typography.Text>
          <Typography.Title level={5}>
            {storages.find((storage) => storage.is_default)?.title ?? '未配置'}
          </Typography.Title>
        </div>
      </div>

      {isRoot ? (
        <section className="file-management-panel__section">
          <div className="file-management-panel__section-header">
            <Typography.Title level={5}>存储配置</Typography.Title>
            <Typography.Paragraph type="secondary">
              新增或维护底层文件存储。Root 可以创建本地目录或 RustFS/S3
              兼容存储，并决定默认写入目标。
            </Typography.Paragraph>
          </div>

          <Form<StorageFormValues>
            form={storageForm}
            layout="vertical"
            className="file-management-panel__form-grid"
            onFinish={(values) => createStorageMutation.mutate(values)}
          >
            <Form.Item
              name="code"
              label="存储编码"
              rules={[{ required: true, message: '请输入存储编码' }]}
            >
              <Input placeholder="例如 local-default" />
            </Form.Item>
            <Form.Item
              name="title"
              label="显示名称"
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input placeholder="例如 主存储" />
            </Form.Item>
            <Form.Item
              name="driver_type"
              label="驱动类型"
              rules={[{ required: true, message: '请选择驱动类型' }]}
            >
              <Select
                options={[
                  { label: 'Local', value: 'local' },
                  { label: 'RustFS / S3 Compatible', value: 'rustfs' }
                ]}
              />
            </Form.Item>
            <Form.Item name="public_base_url" label="公开访问基址">
              <Input placeholder="可选，例如 https://files.example.com" />
            </Form.Item>

            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) =>
                getFieldValue('driver_type') === 'rustfs' ? (
                  <div className="file-management-panel__driver-fields">
                    <Form.Item
                      name="endpoint"
                      label="Endpoint"
                      rules={[{ required: true, message: '请输入 endpoint' }]}
                    >
                      <Input placeholder="http://127.0.0.1:39000" />
                    </Form.Item>
                    <Form.Item
                      name="bucket"
                      label="Bucket"
                      rules={[{ required: true, message: '请输入 bucket' }]}
                    >
                      <Input placeholder="attachments" />
                    </Form.Item>
                    <Form.Item
                      name="access_key"
                      label="Access Key"
                      rules={[{ required: true, message: '请输入 access key' }]}
                    >
                      <Input placeholder="rustfsadmin" />
                    </Form.Item>
                    <Form.Item
                      name="secret_key"
                      label="Secret Key"
                      rules={[{ required: true, message: '请输入 secret key' }]}
                    >
                      <Input.Password placeholder="rustfsadmin" />
                    </Form.Item>
                    <Form.Item name="region" label="Region">
                      <Input placeholder="默认 us-east-1" />
                    </Form.Item>
                    <Form.Item
                      name="force_path_style"
                      label="Path Style"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                    </Form.Item>
                  </div>
                ) : (
                  <div className="file-management-panel__driver-fields">
                    <Form.Item
                      name="root_path"
                      label="根目录"
                      rules={[{ required: true, message: '请输入根目录' }]}
                    >
                      <Input placeholder="/srv/1flowbase/files" />
                    </Form.Item>
                  </div>
                )
              }
            </Form.Item>

            <div className="file-management-panel__form-actions">
              <Form.Item
                name="enabled"
                label="启用"
                valuePropName="checked"
                className="file-management-panel__switch-item"
              >
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
              <Form.Item
                name="is_default"
                label="设为默认"
                valuePropName="checked"
                className="file-management-panel__switch-item"
              >
                <Switch checkedChildren="默认" unCheckedChildren="普通" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={createStorageMutation.isPending}
              >
                创建存储
              </Button>
            </div>
          </Form>

          <Table<SettingsFileStorage>
            rowKey="id"
            columns={storageColumns}
            dataSource={storages}
            loading={storagesQuery.isLoading}
            pagination={false}
          />
        </section>
      ) : null}

      <section className="file-management-panel__section">
        <div className="file-management-panel__section-header">
          <Typography.Title level={5}>文件表</Typography.Title>
          <Typography.Paragraph type="secondary">
            工作区文件表控制上传内容的逻辑归属和当前写入存储。非 root
            用户只显示自己可见的文件表和只读绑定信息。
          </Typography.Paragraph>
        </div>

        <Descriptions
          size="small"
          column={{ xs: 1, md: 3 }}
          items={[
            {
              key: 'root',
              label: '存储管理',
              children: isRoot ? 'Root 可创建与变更' : '仅 Root 可管理'
            },
            {
              key: 'list',
              label: '文件表列表',
              children: canViewTables ? '当前角色可见' : '当前角色不可见'
            },
            {
              key: 'create',
              label: '文件表创建',
              children: canCreateTables ? '允许创建' : '当前角色不可创建'
            }
          ]}
        />

        {canCreateTables ? (
          <>
            <Divider />
            <Form<TableFormValues>
              form={tableForm}
              layout="vertical"
              className="file-management-panel__form-grid"
              onFinish={(values) => createTableMutation.mutate(values)}
            >
              <Form.Item
                name="code"
                label="文件表编码"
                rules={[{ required: true, message: '请输入文件表编码' }]}
              >
                <Input placeholder="例如 workspace_assets" />
              </Form.Item>
              <Form.Item
                name="title"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="例如 Workspace Assets" />
              </Form.Item>
              <div className="file-management-panel__form-actions">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createTableMutation.isPending}
                >
                  创建文件表
                </Button>
              </div>
            </Form>
          </>
        ) : null}

        {canViewTables ? (
          <Table<SettingsFileTable>
            rowKey="id"
            columns={tableColumns}
            dataSource={tables}
            loading={tablesQuery.isLoading}
            pagination={false}
          />
        ) : canCreateTables ? (
          <Alert
            type="info"
            showIcon
            message="当前角色可创建文件表，但没有文件表列表查看权限。"
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="当前角色没有可用的文件表查看或创建能力。"
          />
        )}
      </section>
    </div>
  );
}
