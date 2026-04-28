import { Card, Table, Tag } from 'antd';

import type { NodeLastRun } from '../../../api/runtime';

const STATUS_COLOR: Record<string, string> = {
  succeeded: 'green',
  failed: 'red',
  running: 'blue'
};

function formatDuration(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) {
    return '进行中';
  }

  const durationMs =
    new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  return `${Math.max(durationMs, 0)}`;
}

function summarizeTokenUsage(lastRun: NodeLastRun) {
  const value = lastRun.node_run.metrics_payload.total_tokens;

  if (typeof value === 'number') {
    return `${value}`;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return '—';
}

export function NodeRunSummaryCard({
  lastRun
}: {
  lastRun: NodeLastRun;
}) {
  const row = {
    key: 'summary',
    status: lastRun.flow_run.status,
    duration: formatDuration(
      lastRun.flow_run.started_at,
      lastRun.flow_run.finished_at
    ),
    tokens: summarizeTokenUsage(lastRun)
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] ?? 'default'}>{status}</Tag>
      )
    },
    {
      title: '耗时(ms)',
      dataIndex: 'duration',
      key: 'duration'
    },
    {
      title: 'token',
      dataIndex: 'tokens',
      key: 'tokens'
    }
  ];

  return (
    <Card title="运行摘要">
      <Table
        columns={columns}
        dataSource={[row]}
        pagination={false}
        size="small"
      />
    </Card>
  );
}
