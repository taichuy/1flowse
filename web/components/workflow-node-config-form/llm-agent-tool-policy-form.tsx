"use client";

import type { PluginToolRegistryItem } from "@/lib/get-plugin-registry";
import {
  cloneRecord,
  dedupeStrings,
  parseNumericFieldValue,
  toRecord,
  toStringArray
} from "@/components/workflow-node-config-form/shared";

type LlmAgentToolPolicyFormProps = {
  config: Record<string, unknown>;
  tools: PluginToolRegistryItem[];
  onChange: (nextConfig: Record<string, unknown>) => void;
};

export function LlmAgentToolPolicyForm({
  config,
  tools,
  onChange
}: LlmAgentToolPolicyFormProps) {
  const toolPolicy = toRecord(config.toolPolicy) ?? {};
  const allowedToolIds = dedupeStrings(toStringArray(toolPolicy.allowedToolIds));
  const callableTools = tools.filter((tool) => tool.callable);

  const updateToolPolicy = (patch: { allowedToolIds?: string[]; timeoutMs?: number | undefined }) => {
    const nextConfig = cloneRecord(config);
    const nextToolPolicy = cloneRecord(toolPolicy);

    if (patch.allowedToolIds !== undefined) {
      const normalizedToolIds = dedupeStrings(patch.allowedToolIds);
      if (normalizedToolIds.length === 0) {
        delete nextToolPolicy.allowedToolIds;
      } else {
        nextToolPolicy.allowedToolIds = normalizedToolIds;
      }
    }

    if (patch.timeoutMs !== undefined) {
      nextToolPolicy.timeoutMs = patch.timeoutMs;
    } else if (Object.prototype.hasOwnProperty.call(patch, "timeoutMs")) {
      delete nextToolPolicy.timeoutMs;
    }

    if (Object.keys(nextToolPolicy).length === 0) {
      delete nextConfig.toolPolicy;
    } else {
      nextConfig.toolPolicy = nextToolPolicy;
    }

    onChange(nextConfig);
  };

  const toggleAllowedTool = (toolId: string, checked: boolean) => {
    updateToolPolicy({
      allowedToolIds: checked
        ? [...allowedToolIds, toolId]
        : allowedToolIds.filter((currentToolId) => currentToolId !== toolId)
    });
  };

  return (
    <div className="binding-field">
      <span className="binding-label">Tool policy</span>

      <label className="binding-field">
        <span className="binding-label">Per-tool timeout (ms)</span>
        <input
          className="trace-text-input"
          inputMode="numeric"
          value={typeof toolPolicy.timeoutMs === "number" ? String(toolPolicy.timeoutMs) : ""}
          onChange={(event) =>
            updateToolPolicy({ timeoutMs: parseNumericFieldValue(event.target.value) })
          }
          placeholder="为空时沿用运行时默认值"
        />
      </label>

      <div className="tool-badge-row">
        <button
          className="sync-button"
          type="button"
          onClick={() => updateToolPolicy({ allowedToolIds: [] })}
        >
          允许全部工具
        </button>
      </div>

      {callableTools.length > 0 ? (
        <div className="tool-badge-row">
          {callableTools.map((tool) => {
            const checked = allowedToolIds.includes(tool.id);
            return (
              <label key={tool.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleAllowedTool(tool.id, event.target.checked)}
                />{" "}
                {tool.name || tool.id}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="empty-state compact">
          当前还没有可调用的 tool catalog 项，tool policy 先保留为空即可。
        </p>
      )}

      <small className="section-copy">
        不勾选任何工具表示不额外限制，LLM Agent 可继续使用运行时可见的全部工具；需要收缩权限时，再显式勾选白名单。
      </small>
    </div>
  );
}
