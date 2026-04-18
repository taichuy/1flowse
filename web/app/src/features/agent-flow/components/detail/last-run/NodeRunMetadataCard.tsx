import { Card, Descriptions } from 'antd';

import type { NodeLastRun } from '../../../api/runtime';

function formatTimestamp(value: string | null) {
  if (!value) {
    return '未结束';
  }

  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function summarizeMetric(value: unknown) {
  if (value === null || value === undefined) {
    return '无';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '已记录';
}

function getRuntimeMetadata(lastRun: NodeLastRun) {
  const metrics = lastRun.node_run.metrics_payload ?? {};
  const errorPayload =
    lastRun.node_run.error_payload && typeof lastRun.node_run.error_payload === 'object'
      ? lastRun.node_run.error_payload
      : {};

  return {
    providerInstanceId:
      (metrics.provider_instance_id as unknown) ??
      (errorPayload as Record<string, unknown>).provider_instance_id,
    providerCode:
      (metrics.provider_code as unknown) ??
      (errorPayload as Record<string, unknown>).provider_code,
    protocol:
      (metrics.protocol as unknown) ??
      (errorPayload as Record<string, unknown>).protocol,
    finishReason:
      (metrics.finish_reason as unknown) ??
      (errorPayload as Record<string, unknown>).finish_reason
  };
}

export function NodeRunMetadataCard({
  lastRun
}: {
  lastRun: NodeLastRun;
}) {
  const runtimeMetadata = getRuntimeMetadata(lastRun);

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
            key: 'actor',
            label: '执行人',
            children: lastRun.flow_run.created_by
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
          },
          {
            key: 'plan_id',
            label: 'Compiled Plan',
            children: lastRun.flow_run.compiled_plan_id
          },
          {
            key: 'metrics',
            label: '输出契约数',
            children: summarizeMetric(
              lastRun.node_run.metrics_payload.output_contract_count
            )
          },
          {
            key: 'provider_instance_id',
            label: '模型供应商实例',
            children: summarizeMetric(runtimeMetadata.providerInstanceId)
          },
          {
            key: 'provider_code',
            label: 'Provider Code',
            children: summarizeMetric(runtimeMetadata.providerCode)
          },
          {
            key: 'protocol',
            label: '协议',
            children: summarizeMetric(runtimeMetadata.protocol)
          },
          {
            key: 'finish_reason',
            label: '结束原因',
            children: summarizeMetric(runtimeMetadata.finishReason)
          }
        ]}
      />
    </Card>
  );
}
