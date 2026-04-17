import type { SchemaBlock, CanvasNodeSchema } from '../../../../../shared/schema-ui/contracts/canvas-node-schema';
import { SchemaRenderer } from '../../../../../shared/schema-ui/runtime/SchemaRenderer';
import type { SchemaAdapter } from '../../../../../shared/schema-ui/registry/create-renderer-registry';

import { agentFlowRendererRegistry } from '../../../schema/agent-flow-renderer-registry';
import { NodeInspector, useNodeSchemaRuntime } from '../../inspector/NodeInspector';
import { NodeRelationsCard } from '../cards/NodeRelationsCard';

function isNonSectionBlock(block: SchemaBlock) {
  return block.kind !== 'section' && !(block.kind === 'view' && block.renderer === 'relations');
}

export function NodeConfigTab({
  schema,
  adapter
}: {
  schema?: CanvasNodeSchema;
  adapter?: SchemaAdapter;
} = {}) {
  const runtime = useNodeSchemaRuntime(!schema || !adapter);
  const activeSchema = schema ?? runtime.schema;
  const activeAdapter = adapter ?? runtime.adapter;

  if (!activeSchema || !activeAdapter) {
    return null;
  }

  const viewBlocks = activeSchema.detail.tabs.config.blocks.filter(isNonSectionBlock);

  return (
    <div className="agent-flow-node-detail__config-tab">
      <NodeInspector schema={activeSchema} adapter={activeAdapter} />
      <SchemaRenderer
        adapter={activeAdapter}
        blocks={viewBlocks}
        registry={agentFlowRendererRegistry}
      />
      <NodeRelationsCard adapter={activeAdapter} />
    </div>
  );
}
