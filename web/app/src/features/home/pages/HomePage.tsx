import { useQuery } from '@tanstack/react-query';
import { Button, Card, Space, Typography } from 'antd';

import { useAppStore } from '../../../state/app-store';
import { getApiHealthQueryOptions } from '../api/health';

export function HomePage() {
  const visitCount = useAppStore((state) => state.visitCount);
  const increment = useAppStore((state) => state.increment);
  const healthQuery = useQuery(
    getApiHealthQueryOptions(typeof window !== 'undefined' ? window.location : undefined)
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Workspace Bootstrap">
        <Typography.Paragraph>
          Frontend monorepo and backend health endpoint are wired together.
        </Typography.Paragraph>
        <Typography.Paragraph>Visit count: {visitCount}</Typography.Paragraph>
        <Button onClick={increment}>Increment</Button>
      </Card>
      <Card title="API Health">
        <Typography.Paragraph>
          {healthQuery.isPending && 'Loading health status...'}
          {healthQuery.isError && 'Health request failed.'}
          {healthQuery.data &&
            `${healthQuery.data.service} ${healthQuery.data.status} (${healthQuery.data.version})`}
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
