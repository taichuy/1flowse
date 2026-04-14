import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import {
  createSettingsMember,
  disableSettingsMember,
  fetchSettingsMembers,
  replaceSettingsMemberRoles,
  resetSettingsMemberPassword,
  settingsMembersQueryKey,
  type SettingsMember
} from '../api/members';
import { fetchSettingsRoles, settingsRolesQueryKey } from '../api/roles';

const TEMP_PASSWORD = 'Temp@123456';

export function MemberManagementPanel({
  canManageMembers,
  canManageRoleBindings
}: {
  canManageMembers: boolean;
  canManageRoleBindings: boolean;
}) {
  const queryClient = useQueryClient();
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const [form] = Form.useForm();
  const membersQuery = useQuery({
    queryKey: settingsMembersQueryKey,
    queryFn: fetchSettingsMembers
  });
  const rolesQuery = useQuery({
    queryKey: settingsRolesQueryKey,
    queryFn: fetchSettingsRoles,
    enabled: canManageRoleBindings
  });

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: settingsMembersQueryKey });

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return createSettingsMember(
        {
          account: String(values.account ?? ''),
          email: String(values.email ?? ''),
          phone: values.phone ? String(values.phone) : null,
          password: String(values.password ?? ''),
          name: String(values.name ?? ''),
          nickname: String(values.nickname ?? ''),
          introduction: String(values.introduction ?? ''),
          email_login_enabled: Boolean(values.email_login_enabled),
          phone_login_enabled: Boolean(values.phone_login_enabled)
        },
        csrfToken
      );
    },
    onSuccess: async () => {
      form.resetFields();
      await invalidateMembers();
    }
  });

  const disableMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return disableSettingsMember(memberId, csrfToken);
    },
    onSuccess: invalidateMembers
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return resetSettingsMemberPassword(
        memberId,
        { new_password: TEMP_PASSWORD },
        csrfToken
      );
    }
  });

  const replaceRolesMutation = useMutation({
    mutationFn: async ({
      memberId,
      roleCodes
    }: {
      memberId: string;
      roleCodes: string[];
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return replaceSettingsMemberRoles(
        memberId,
        { role_codes: roleCodes },
        csrfToken
      );
    },
    onSuccess: invalidateMembers
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3}>用户管理</Typography.Title>
        <Typography.Paragraph>
          查看当前工作台成员、创建账号，并在授权范围内执行停用、重置密码与角色调整。
        </Typography.Paragraph>
      </div>

      {canManageMembers ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Space wrap size="middle" align="start">
            <Form.Item
              label="账号"
              name="account"
              rules={[{ required: true, message: '请输入账号。' }]}
            >
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ required: true, message: '请输入邮箱。' }]}
            >
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item label="手机号" name="phone">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item
              label="初始密码"
              name="password"
              initialValue={TEMP_PASSWORD}
              rules={[{ required: true, message: '请输入初始密码。' }]}
            >
              <Input.Password style={{ width: 200 }} />
            </Form.Item>
            <Form.Item
              label="姓名"
              name="name"
              rules={[{ required: true, message: '请输入姓名。' }]}
            >
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item
              label="昵称"
              name="nickname"
              rules={[{ required: true, message: '请输入昵称。' }]}
            >
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item label="介绍" name="introduction">
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item
              label="邮箱登录"
              name="email_login_enabled"
              valuePropName="checked"
              initialValue
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label="手机登录"
              name="phone_login_enabled"
              valuePropName="checked"
              initialValue={false}
            >
              <Switch />
            </Form.Item>
            <Form.Item label=" ">
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
                新建用户
              </Button>
            </Form.Item>
          </Space>
        </Form>
      ) : null}

      <Typography.Paragraph type="secondary">
        使用“重置密码”会将目标账号密码重置为 `{TEMP_PASSWORD}`，并要求用户登录后立即修改。
      </Typography.Paragraph>

      <Table<SettingsMember>
        rowKey="id"
        loading={membersQuery.isLoading}
        dataSource={membersQuery.data ?? []}
        pagination={false}
        columns={[
          {
            title: '账号',
            dataIndex: 'account'
          },
          {
            title: '姓名 / 昵称',
            render: (_, member) => (
              <Space size="small">
                <span>{member.name}</span>
                <Typography.Text type="secondary">{member.nickname}</Typography.Text>
              </Space>
            )
          },
          {
            title: '联系方式',
            render: (_, member) => (
              <Space direction="vertical" size={0}>
                <span>{member.email}</span>
                {member.phone ? (
                  <Typography.Text type="secondary">{member.phone}</Typography.Text>
                ) : null}
              </Space>
            )
          },
          {
            title: '状态',
            render: (_, member) => (
              <Tag color={member.status === 'active' ? 'green' : 'default'}>
                {member.status === 'active' ? '启用' : '停用'}
              </Tag>
            )
          },
          {
            title: '角色',
            render: (_, member) =>
              canManageRoleBindings ? (
                <Select
                  mode="multiple"
                  style={{ minWidth: 220 }}
                  value={member.role_codes}
                  options={(rolesQuery.data ?? []).map((role) => ({
                    label: role.name,
                    value: role.code
                  }))}
                  onChange={(roleCodes) =>
                    replaceRolesMutation.mutate({
                      memberId: member.id,
                      roleCodes
                    })
                  }
                />
              ) : (
                <Space wrap>
                  {member.role_codes.map((roleCode) => (
                    <Tag key={roleCode}>{roleCode}</Tag>
                  ))}
                </Space>
              )
          },
          {
            title: '操作',
            render: (_, member) =>
              canManageMembers ? (
                <Space>
                  <Button
                    size="small"
                    onClick={() => disableMutation.mutate(member.id)}
                    loading={disableMutation.isPending}
                  >
                    停用
                  </Button>
                  <Button
                    size="small"
                    onClick={() => resetPasswordMutation.mutate(member.id)}
                    loading={resetPasswordMutation.isPending}
                  >
                    重置密码
                  </Button>
                </Space>
              ) : (
                <Typography.Text type="secondary">只读</Typography.Text>
              )
          }
        ]}
      />
    </Space>
  );
}
