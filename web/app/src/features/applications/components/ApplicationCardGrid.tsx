import { Button, Flex, List, Tag, Typography } from 'antd';

import type { Application } from '../api/applications';

interface ApplicationCardGridProps {
  applications: Application[];
}

function applicationTypeLabel(applicationType: Application['application_type']) {
  return applicationType === 'agent_flow' ? 'AgentFlow' : 'Workflow';
}

export function ApplicationCardGrid({ applications }: ApplicationCardGridProps) {
  return (
    <List
      grid={{ gutter: 16, column: 2 }}
      dataSource={applications}
      renderItem={(application) => (
        <List.Item>
          <Flex
            vertical
            gap={12}
            style={{
              padding: 16,
              border: '1px solid rgba(15, 23, 42, 0.08)',
              borderRadius: 16,
              background: '#ffffff'
            }}
          >
            <Flex justify="space-between" align="center" gap={12}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {application.name}
              </Typography.Title>
              <Tag>{applicationTypeLabel(application.application_type)}</Tag>
            </Flex>

            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {application.description || '当前应用尚未填写简介。'}
            </Typography.Paragraph>

            <Typography.Text type="secondary">
              最近更新：{new Date(application.updated_at).toLocaleString('zh-CN')}
            </Typography.Text>

            <a href={`/applications/${application.id}/orchestration`}>
              <Button type="primary">进入应用</Button>
            </a>
          </Flex>
        </List.Item>
      )}
    />
  );
}
