import { useParams } from '@tanstack/react-router';
import { Card, Descriptions, Typography } from 'antd';

import type { EmbeddedAppManifest } from '@1flowse/embedded-contracts';

const placeholderManifest: EmbeddedAppManifest = {
  appId: 'demo-embedded-app',
  entry: 'dist/index.html',
  name: 'Demo Embedded App',
  routePrefix: '/embedded/demo-embedded-app',
  version: '0.1.0'
};

export function EmbeddedAppDetailPage() {
  const { embeddedAppId } = useParams({ strict: false });

  return (
    <Card title="Embedded App Detail">
      <Typography.Paragraph>
        查看单个嵌入式前端应用的挂载信息、清单入口和当前路由映射。
      </Typography.Paragraph>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Embedded App ID">
          {embeddedAppId ?? placeholderManifest.appId}
        </Descriptions.Item>
        <Descriptions.Item label="Manifest Entry">
          {placeholderManifest.entry}
        </Descriptions.Item>
        <Descriptions.Item label="Route Prefix">
          {placeholderManifest.routePrefix}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
