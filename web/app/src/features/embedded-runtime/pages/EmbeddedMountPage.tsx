import { useParams } from '@tanstack/react-router';
import { Card, Descriptions, Typography } from 'antd';

import { createEmbedContext } from '@1flowse/embed-sdk';

export function EmbeddedMountPage() {
  const { embeddedAppId } = useParams({ strict: false });
  const context = createEmbedContext({
    applicationId: 'bootstrap-application',
    teamId: 'bootstrap-team'
  });

  return (
    <Card title="Embedded App Mount">
      <Typography.Paragraph>
        展示嵌入式前端应用在宿主中的挂载结果和当前上下文信息。
      </Typography.Paragraph>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Embedded App ID">
          {embeddedAppId ?? 'unknown'}
        </Descriptions.Item>
        <Descriptions.Item label="Application Context">
          {context.applicationId}
        </Descriptions.Item>
        <Descriptions.Item label="Team Context">
          {context.teamId}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
