import type { CanvasNodeSchema } from '../../../../../shared/schema-ui/contracts/canvas-node-schema';
import type { SchemaAdapter } from '../../../../../shared/schema-ui/registry/create-renderer-registry';

import { NodeInspector, useNodeSchemaRuntime } from '../../inspector/NodeInspector';

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

  return (
    <div className="agent-flow-node-detail__config-tab">
      <NodeInspector schema={activeSchema} adapter={activeAdapter} />
    </div>
  );
}
