import { useQuery } from '@tanstack/react-query';
import type { FlowNodeDocument } from '@1flowbase/flow-schema';

import {
  fetchModelProviderOptions,
  modelProviderOptionsQueryKey
} from '../../api/model-provider-options';
import { getLlmModelProvider } from '../../lib/llm-node-config';

export function LlmCardModelBadge({
  node
}: {
  node: Pick<FlowNodeDocument, 'config'>;
}) {
  const modelProvider = getLlmModelProvider(node.config);
  const providerCode = modelProvider.provider_code.trim();
  const model = modelProvider.model_id.trim();

  const { data: providerOptions } = useQuery({
    queryKey: modelProviderOptionsQueryKey,
    queryFn: fetchModelProviderOptions,
    staleTime: 60_000
  });

  const providerIcon =
    providerOptions?.providers?.find(
      (provider) => provider.provider_code === providerCode
    )?.icon || null;

  return (
    <div className="agent-flow-node-card__model agent-flow-node-card__model--llm">
      <span className="agent-flow-node-card__model-provider" aria-hidden="true">
        {providerIcon ? (
          <img
            className="agent-flow-node-card__model-provider-image"
            src={providerIcon}
            alt=""
          />
        ) : null}
      </span>
      <span className="agent-flow-node-card__model-content">
        <span className="agent-flow-node-card__model-provider-label">
          {modelProvider.provider_label || providerCode || '模型供应商未选择'}
        </span>
        <span className="agent-flow-node-card__model-label">
          {modelProvider.model_label || model || '选择模型'}
        </span>
      </span>
    </div>
  );
}
