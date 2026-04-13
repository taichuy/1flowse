import { Card, List, Typography } from 'antd';

const embeddedAppCapabilities = [
  '已接入应用的版本与构建产物清单',
  '路由前缀、挂载上下文和宿主约束',
  '后续接入发布、回滚和运行态诊断的入口'
];

export function EmbeddedAppsPage() {
  return (
    <Card title="Embedded Apps">
      <Typography.Paragraph>
        管理已接入的嵌入式前端应用版本、路由前缀和挂载上下文。
      </Typography.Paragraph>
      <List
        dataSource={embeddedAppCapabilities}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    </Card>
  );
}
