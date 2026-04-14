import { useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Space, Typography } from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import { getApiHealthQueryOptions } from '../api/health';

export function HomePage() {
  const actor = useAuthStore((state) => state.actor);
  const me = useAuthStore((state) => state.me);
  const healthQuery = useQuery(
    getApiHealthQueryOptions(typeof window !== 'undefined' ? window.location : undefined)
  );
  const displayName = me?.name || actor?.account || '用户';
  const effectiveRole = me?.effective_display_role || actor?.effective_display_role || 'unknown';

  const healthSummary = healthQuery.isPending
    ? '正在检查连接状态'
    : healthQuery.isError
      ? '连接检查失败'
      : `${healthQuery.data.service} ${healthQuery.data.status} (${healthQuery.data.version})`;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>工作台</Typography.Title>
        <Typography.Paragraph>
          这里汇聚当前账号的工作台状态、身份摘要与控制台基础连接信息。
        </Typography.Paragraph>
      </div>

      <Card>
        <Space direction="vertical" size="small">
          <Typography.Title level={3} style={{ margin: 0 }}>
            欢迎，{displayName}
          </Typography.Title>
          <Typography.Text type="secondary">当前角色 {effectiveRole}</Typography.Text>
        </Space>
      </Card>

      <Descriptions
        bordered
        column={1}
        items={[
          {
            key: 'health',
            label: '后端健康检查',
            children: healthSummary
          },
          {
            key: 'workspace',
            label: '当前工作台',
            children: actor?.current_workspace_id ?? '未绑定'
          }
        ]}
      />
    </Space>
  );
}
