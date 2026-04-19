import type { SchemaBlock, CanvasNodeSchema } from '../../../../shared/schema-ui/contracts/canvas-node-schema';
import { SchemaRenderer } from '../../../../shared/schema-ui/runtime/SchemaRenderer';
import type { SchemaAdapter } from '../../../../shared/schema-ui/registry/create-renderer-registry';
import { useEffect, useMemo, useRef } from 'react';
import { Typography } from 'antd';

import { createAgentFlowNodeSchemaAdapter } from '../../schema/node-schema-adapter';
import { agentFlowRendererRegistry } from '../../schema/agent-flow-renderer-registry';
import { resolveAgentFlowNodeSchema } from '../../schema/node-schema-registry';
import { useAgentFlowEditorStore } from '../../store/editor/provider';
import {
  selectSelectedNodeId,
  selectWorkingDocument
} from '../../store/editor/selectors';

function isSectionBlock(
  block: SchemaBlock
): block is Extract<SchemaBlock, { kind: 'section' }> {
  return block.kind === 'section';
}

function isFieldBlock(
  block: SchemaBlock
): block is Extract<SchemaBlock, { kind: 'field' }> {
  return block.kind === 'field';
}

function isInlineFieldRenderer(renderer: string) {
  return renderer === 'text' || renderer === 'number' || renderer === 'selector';
}

function shouldRenderSectionTitle(title: string) {
  return title !== 'Inputs';
}

function resolveFocusableFieldKey(fieldKey: string) {
  if (
    fieldKey === 'config.model' ||
    fieldKey === 'config.provider_instance_id'
  ) {
    return 'config.model_provider';
  }

  return fieldKey;
}

export function useNodeSchemaRuntime(enabled = true) {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const selectedNodeId = useAgentFlowEditorStore(selectSelectedNodeId);
  const setWorkingDocument = useAgentFlowEditorStore(
    (state) => state.setWorkingDocument
  );
  const selectedNode = selectedNodeId
    ? document.graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const schema = useMemo(
    () =>
      enabled && selectedNode ? resolveAgentFlowNodeSchema(selectedNode.type) : null,
    [enabled, selectedNode]
  );
  const adapter = useMemo(
    () =>
      enabled && selectedNodeId
        ? createAgentFlowNodeSchemaAdapter({
            document,
            nodeId: selectedNodeId,
            setWorkingDocument,
            dispatch: () => undefined
          })
        : null,
    [document, enabled, selectedNodeId, setWorkingDocument]
  );

  return {
    document,
    selectedNodeId,
    selectedNode,
    schema,
    adapter
  };
}

export function NodeInspector({
  schema,
  adapter
}: {
  schema?: CanvasNodeSchema;
  adapter?: SchemaAdapter;
} = {}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);
  const focusFieldKey = useAgentFlowEditorStore((state) => state.focusedFieldKey);
  const runtime = useNodeSchemaRuntime(!schema || !adapter);
  const activeSchema = schema ?? runtime.schema;
  const activeAdapter = adapter ?? runtime.adapter;
  const configBlocks = activeSchema?.detail.tabs.config.blocks ?? [];

  useEffect(() => {
    if (!focusFieldKey || !rootRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const resolvedFieldKey = resolveFocusableFieldKey(focusFieldKey);
      const focusTarget = rootRef.current?.querySelector<HTMLElement>(
        `[data-field-key="${resolvedFieldKey}"] [aria-label]`
      );
      focusTarget?.focus();
      setSelection({
        focusedFieldKey: null
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [focusFieldKey, setSelection]);

  if (!activeSchema || !activeAdapter) {
    return null;
  }

  return (
    <section ref={rootRef} className="agent-flow-node-detail__inspector">
      {configBlocks.map((block, blockIndex) => {
        if (!isSectionBlock(block)) {
          return (
            <SchemaRenderer
              key={`config-block-${blockIndex}`}
              adapter={activeAdapter}
              blocks={[block]}
              registry={agentFlowRendererRegistry}
            />
          );
        }

        return (
          <div
            key={block.title}
            className="agent-flow-node-detail__section agent-flow-node-detail__inspector-section"
            data-section-key={block.title}
          >
            {shouldRenderSectionTitle(block.title) ? (
              <div className="agent-flow-node-detail__section-header">
                <Typography.Title
                  level={5}
                  className="agent-flow-node-detail__section-title"
                >
                  {block.title}
                </Typography.Title>
              </div>
            ) : null}
            <div className="agent-flow-editor__inspector-fields">
              {block.blocks.map((childBlock, index) => {
                if (isFieldBlock(childBlock)) {
                  if (childBlock.path === 'config.output_contract') {
                    return null;
                  }

                  return (
                    <div
                      key={childBlock.path}
                      className={[
                        'agent-flow-editor__inspector-field',
                        isInlineFieldRenderer(childBlock.renderer)
                          ? 'agent-flow-editor__inspector-field--inline'
                          : null
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      data-field-key={childBlock.path}
                      data-testid={`inspector-field-${childBlock.path}`}
                    >
                      <Typography.Text
                        strong
                        className="agent-flow-editor__inspector-field-label"
                      >
                        {childBlock.label}
                      </Typography.Text>
                      <div className="agent-flow-editor__inspector-field-control">
                        <SchemaRenderer
                          adapter={activeAdapter}
                          blocks={[childBlock]}
                          registry={agentFlowRendererRegistry}
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <SchemaRenderer
                    key={`${block.title}-${index}`}
                    adapter={activeAdapter}
                    blocks={[childBlock]}
                    registry={agentFlowRendererRegistry}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
