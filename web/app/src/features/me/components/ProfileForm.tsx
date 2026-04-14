import { useEffect } from 'react';

import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  Space,
  Tag,
  Typography
} from 'antd';

import type { MyProfile, UpdateMyProfileInput } from '../api/me';

interface ProfileFormValues {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  avatar_url: string;
  introduction: string;
}

export function ProfileForm({
  me,
  statusLabel,
  submitting,
  errorMessage,
  onSubmit
}: {
  me: MyProfile;
  statusLabel: string;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: UpdateMyProfileInput) => Promise<void> | void;
}) {
  const [form] = Form.useForm<ProfileFormValues>();

  useEffect(() => {
    form.setFieldsValue({
      name: me.name,
      nickname: me.nickname,
      email: me.email,
      phone: me.phone ?? '',
      avatar_url: me.avatar_url ?? '',
      introduction: me.introduction
    });
  }, [form, me]);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3}>基本资料</Typography.Title>
        <Typography.Paragraph>
          编辑你的公开资料，账号与权限信息保持只读，避免与系统设置职责混淆。
        </Typography.Paragraph>
      </div>

      <Descriptions
        bordered
        column={1}
        items={[
          {
            key: 'display-name',
            label: '当前展示名称',
            children: `当前展示名称：${me.nickname || me.name || me.account}`
          },
          {
            key: 'account',
            label: '账号',
            children: me.account
          },
          {
            key: 'role',
            label: '当前角色',
            children: me.effective_display_role
          },
          {
            key: 'status',
            label: '状态',
            children: <Tag color="green">{statusLabel}</Tag>
          },
          {
            key: 'permissions',
            label: '权限',
            children:
              me.permissions.length > 0 ? (
                <Space size={[8, 8]} wrap>
                  {me.permissions.map((permission) => (
                    <Tag key={permission}>{permission}</Tag>
                  ))}
                </Space>
              ) : (
                '暂无显式权限'
              )
          }
        ]}
      />

      {errorMessage ? <Alert type="error" message={errorMessage} showIcon /> : null}

      <Form<ProfileFormValues>
        form={form}
        layout="vertical"
        onFinish={(values) =>
          onSubmit({
            name: values.name.trim(),
            nickname: values.nickname.trim(),
            email: values.email.trim(),
            phone: values.phone.trim() ? values.phone.trim() : null,
            avatar_url: values.avatar_url.trim() ? values.avatar_url.trim() : null,
            introduction: values.introduction.trim()
          })
        }
      >
        <Form.Item
          label="姓名"
          name="name"
          rules={[{ required: true, message: '请输入姓名。' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="昵称"
          name="nickname"
          rules={[{ required: true, message: '请输入昵称。' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ required: true, message: '请输入邮箱。' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="手机号" name="phone">
          <Input />
        </Form.Item>
        <Form.Item label="头像地址" name="avatar_url">
          <Input placeholder="https://example.com/avatar.png" />
        </Form.Item>
        <Form.Item label="个人介绍" name="introduction">
          <Input.TextArea rows={4} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          保存资料
        </Button>
      </Form>
    </Space>
  );
}
