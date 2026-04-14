import { List, Space, Typography } from 'antd';

const embeddedAppCapabilities = [
  '已接入应用的版本与构建产物清单',
  '路由前缀、挂载上下文和宿主约束',
  '后续接入发布、回滚和运行态诊断的入口'
];

export function EmbeddedAppsPage() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>子系统</Typography.Title>
        <Typography.Paragraph>
          管理已接入子系统的发布清单、路由前缀与宿主约束。
        </Typography.Paragraph>
      </div>
      <Typography.Paragraph>
        当前页用于统一查看已接入子系统的运行边界和接入状态。
      </Typography.Paragraph>
      <List
        dataSource={embeddedAppCapabilities}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    </Space>
  );
}
