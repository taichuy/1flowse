import { useQuery } from '@tanstack/react-query';
import { Empty, Result } from 'antd';

import type { CanvasNodeSchema } from '../../../../../shared/schema-ui/contracts/canvas-node-schema';
import { SchemaRenderer } from '../../../../../shared/schema-ui/runtime/SchemaRenderer';
import type { SchemaAdapter } from '../../../../../shared/schema-ui/registry/create-renderer-registry';

import {
  fetchNodeLastRun,
  nodeLastRunQueryKey
} from '../../../api/runtime';
import { agentFlowRendererRegistry } from '../../../schema/agent-flow-renderer-registry';
import { NodeRunIOCard } from '../last-run/NodeRunIOCard';
import { NodeRunMetadataCard } from '../last-run/NodeRunMetadataCard';
import { NodeRunSummaryCard } from '../last-run/NodeRunSummaryCard';

function isNodeLastRun(value: unknown): value is NonNullable<
  Awaited<ReturnType<typeof fetchNodeLastRun>>
> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return Boolean(
    candidate.flow_run &&
      typeof candidate.flow_run === 'object' &&
      candidate.node_run &&
      typeof candidate.node_run === 'object' &&
      Array.isArray(candidate.events)
  );
}

export function NodeLastRunTab({
  applicationId,
  nodeId,
  schema,
  adapter
}: {
  applicationId?: string;
  nodeId?: string;
  schema?: CanvasNodeSchema;
  adapter?: SchemaAdapter;
}) {
  const lastRunQuery = useQuery({
    queryKey: nodeLastRunQueryKey(applicationId ?? 'unknown', nodeId ?? 'unknown'),
    queryFn: () => fetchNodeLastRun(applicationId!, nodeId!),
    enabled: Boolean(applicationId && nodeId)
  });
  if (lastRunQuery.isPending) {
    return <Result status="info" title="正在加载上次运行" />;
  }

  if (lastRunQuery.isError) {
    return <Result status="error" title="上次运行加载失败" />;
  }

  if (!lastRunQuery.data) {
    return (
      <Empty
        description="当前节点还没有运行记录"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  if (!isNodeLastRun(lastRunQuery.data)) {
    return <Result status="warning" title="上次运行数据异常" />;
  }

  const lastRun = lastRunQuery.data;

  if (!schema || !adapter) {
    return (
      <div className="agent-flow-node-detail__last-run">
        <NodeRunSummaryCard lastRun={lastRun} />
        <NodeRunIOCard lastRun={lastRun} />
        <NodeRunMetadataCard lastRun={lastRun} />
      </div>
    );
  }

  const runtimeAdapter: SchemaAdapter = {
    ...adapter,
    getDerived(key: string) {
      if (key === 'lastRun') {
        return lastRun;
      }

      return adapter.getDerived(key);
    }
  };

  return (
    <div className="agent-flow-node-detail__last-run">
      <SchemaRenderer
        adapter={runtimeAdapter}
        blocks={schema.detail.tabs.lastRun.blocks}
        registry={agentFlowRendererRegistry}
      />
    </div>
  );
}
