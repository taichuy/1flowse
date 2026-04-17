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
  const runtimeAdapter =
    schema && adapter
      ? {
          ...adapter,
          getDerived(key: string) {
            if (key === 'lastRun') {
              return lastRunQuery.data;
            }

            return adapter.getDerived(key);
          }
        }
      : null;

  if (lastRunQuery.isPending) {
    return <Result status="info" title="正在加载上次运行" />;
  }

  if (!lastRunQuery.data) {
    return (
      <Empty
        description="当前节点还没有运行记录"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  if (!schema || !adapter) {
    return (
      <div className="agent-flow-node-detail__last-run">
        <NodeRunSummaryCard lastRun={lastRunQuery.data} />
        <NodeRunIOCard lastRun={lastRunQuery.data} />
        <NodeRunMetadataCard lastRun={lastRunQuery.data} />
      </div>
    );
  }

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
