import { useEffect, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import { fetchSettingsPermissions, settingsPermissionsQueryKey } from '../api/permissions';
import {
  createSettingsRole,
  deleteSettingsRole,
  fetchSettingsRolePermissions,
  fetchSettingsRoles,
  replaceSettingsRolePermissions,
  settingsRolePermissionsQueryKey,
  settingsRolesQueryKey,
  updateSettingsRole,
  type SettingsRole
} from '../api/roles';

export function RolePermissionPanel({
  canManageRoles
}: {
  canManageRoles: boolean;
}) {
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const queryClient = useQueryClient();
  const [selectedRoleCode, setSelectedRoleCode] = useState<string | null>(null);
  const [createForm] = Form.useForm();

  const rolesQuery = useQuery({
    queryKey: settingsRolesQueryKey,
    queryFn: fetchSettingsRoles
  });
  const permissionsQuery = useQuery({
    queryKey: settingsPermissionsQueryKey,
    queryFn: fetchSettingsPermissions
  });

  useEffect(() => {
    if (!selectedRoleCode && rolesQuery.data?.length) {
      setSelectedRoleCode(rolesQuery.data[0].code);
    }
  }, [rolesQuery.data, selectedRoleCode]);

  const rolePermissionsQuery = useQuery({
    queryKey: settingsRolePermissionsQueryKey(selectedRoleCode ?? 'none'),
    queryFn: () => fetchSettingsRolePermissions(selectedRoleCode ?? ''),
    enabled: Boolean(selectedRoleCode)
  });

  const invalidateRoles = async () => {
    await queryClient.invalidateQueries({ queryKey: settingsRolesQueryKey });
    if (selectedRoleCode) {
      await queryClient.invalidateQueries({
        queryKey: settingsRolePermissionsQueryKey(selectedRoleCode)
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return createSettingsRole(
        {
          code: String(values.code ?? ''),
          name: String(values.name ?? ''),
          introduction: String(values.introduction ?? '')
        },
        csrfToken
      );
    },
    onSuccess: async () => {
      createForm.resetFields();
      await invalidateRoles();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      roleCode,
      role
    }: {
      roleCode: string;
      role: SettingsRole;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return updateSettingsRole(
        roleCode,
        {
          name: role.name,
          introduction: ''
        },
        csrfToken
      );
    },
    onSuccess: invalidateRoles
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleCode: string) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return deleteSettingsRole(roleCode, csrfToken);
    },
    onSuccess: async () => {
      setSelectedRoleCode(null);
      await invalidateRoles();
    }
  });

  const replacePermissionsMutation = useMutation({
    mutationFn: async (permissionCodes: string[]) => {
      if (!csrfToken || !selectedRoleCode) {
        throw new Error('missing selection');
      }

      return replaceSettingsRolePermissions(
        selectedRoleCode,
        {
          permission_codes: permissionCodes
        },
        csrfToken
      );
    },
    onSuccess: invalidateRoles
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3}>权限管理</Typography.Title>
        <Typography.Paragraph>
          管理工作台角色、查看权限绑定，并在授权范围内调整角色定义。
        </Typography.Paragraph>
      </div>

      {canManageRoles ? (
        <Form
          form={createForm}
          layout="inline"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            label="角色编码"
            name="code"
            rules={[{ required: true, message: '请输入角色编码。' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, message: '请输入角色名称。' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="说明" name="introduction">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending}
            >
              新建角色
            </Button>
          </Form.Item>
        </Form>
      ) : null}

      <Table<SettingsRole>
        rowKey="code"
        loading={rolesQuery.isLoading}
        dataSource={rolesQuery.data ?? []}
        pagination={false}
        columns={[
          {
            title: '角色',
            render: (_, role) => (
              <Space direction="vertical" size={0}>
                <Typography.Text strong>{role.name}</Typography.Text>
                <Typography.Text type="secondary">{role.code}</Typography.Text>
              </Space>
            )
          },
          {
            title: '范围',
            render: (_, role) => <Tag>{role.scope_kind}</Tag>
          },
          {
            title: '内置',
            render: (_, role) => <Tag>{role.is_builtin ? '内置' : '自定义'}</Tag>
          },
          {
            title: '权限数',
            render: (_, role) => role.permission_codes.length
          },
          {
            title: '操作',
            render: (_, role) =>
              canManageRoles ? (
                <Space>
                  <Button
                    size="small"
                    onClick={() => updateMutation.mutate({ roleCode: role.code, role })}
                    loading={updateMutation.isPending}
                  >
                    更新
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => deleteMutation.mutate(role.code)}
                    loading={deleteMutation.isPending}
                    disabled={!role.is_editable}
                  >
                    删除
                  </Button>
                </Space>
              ) : (
                <Typography.Text type="secondary">只读</Typography.Text>
              )
          }
        ]}
      />

      <div>
        <Typography.Title level={4}>权限绑定编辑器</Typography.Title>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Select
            value={selectedRoleCode ?? undefined}
            placeholder="选择要编辑的角色"
            options={(rolesQuery.data ?? []).map((role) => ({
              label: role.name,
              value: role.code
            }))}
            onChange={setSelectedRoleCode}
            style={{ maxWidth: 320 }}
          />
          <Select
            mode="multiple"
            disabled={!selectedRoleCode || !canManageRoles}
            loading={permissionsQuery.isLoading || rolePermissionsQuery.isLoading}
            value={rolePermissionsQuery.data?.permission_codes ?? []}
            options={(permissionsQuery.data ?? []).map((permission) => ({
              label: `${permission.name} (${permission.code})`,
              value: permission.code
            }))}
            onChange={(permissionCodes) => replacePermissionsMutation.mutate(permissionCodes)}
            style={{ width: '100%' }}
            placeholder="选择权限并自动保存"
          />
        </Space>
      </div>
    </Space>
  );
}
