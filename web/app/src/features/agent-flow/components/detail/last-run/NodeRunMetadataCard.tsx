import { Card, Descriptions } from 'antd';

import type { NodeLastRun } from '../../../api/runtime';

function formatTimestamp(value: string | null) {
  if (!value) {
    return '未结束';
  }

  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function NodeRunMetadataCard({
  lastRun
}: {
  lastRun: NodeLastRun;
}) {
  return (
    <Card title="元数据">
      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: 'node_alias',
            label: '节点',
            children: `${lastRun.node_run.node_alias} (${lastRun.node_run.node_id})`
          },
          {
            key: 'node_type',
            label: '节点类型',
            children: lastRun.node_run.node_type
          },
          {
            key: 'started_at',
            label: '开始时间',
            children: formatTimestamp(lastRun.node_run.started_at)
          },
          {
            key: 'finished_at',
            label: '结束时间',
            children: formatTimestamp(lastRun.node_run.finished_at)
          }
        ]}
      />
    </Card>
  );
}
