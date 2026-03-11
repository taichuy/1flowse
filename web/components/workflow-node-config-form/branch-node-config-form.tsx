"use client";

import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";
import {
  BRANCH_OPERATORS,
  cloneRecord,
  createDefaultBranchRule,
  formatBranchRuleValue,
  parseBranchRuleValue,
  readBranchMode,
  readDefaultBranch,
  readSelectorRules,
  toRecord,
  type BranchMode
} from "@/components/workflow-node-config-form/shared";

type BranchNodeConfigFormProps = {
  node: Node<WorkflowCanvasNodeData>;
  onChange: (nextConfig: Record<string, unknown>) => void;
};

export function BranchNodeConfigForm({
  node,
  onChange
}: BranchNodeConfigFormProps) {
  const config = cloneRecord(node.data.config);
  const branchMode = readBranchMode(config);
  const selector = toRecord(config.selector) ?? {};
  const rules = readSelectorRules(selector.rules, node.data.nodeType);
  const expression = typeof config.expression === "string" ? config.expression : "";
  const defaultBranch = readDefaultBranch(config);
  const fixedBranch =
    typeof config.selected === "string" && config.selected.trim()
      ? config.selected
      : "default";

  const applyBranchMode = (nextMode: BranchMode) => {
    const nextConfig = cloneRecord(config);

    if (nextMode === "selector") {
      delete nextConfig.expression;
      delete nextConfig.selected;
      delete nextConfig.default;
      nextConfig.selector =
        Object.keys(selector).length > 0
          ? selector
          : {
              rules: [createDefaultBranchRule(node.data.nodeType)]
            };
      onChange(nextConfig);
      return;
    }

    if (nextMode === "expression") {
      delete nextConfig.selector;
      delete nextConfig.selected;
      nextConfig.expression =
        expression ||
        (node.data.nodeType === "condition"
          ? "trigger_input.approved"
          : "trigger_input.intent");
      if (defaultBranch && defaultBranch !== "default") {
        nextConfig.default = defaultBranch;
      } else {
        delete nextConfig.default;
      }
      onChange(nextConfig);
      return;
    }

    delete nextConfig.selector;
    delete nextConfig.expression;
    delete nextConfig.default;
    nextConfig.selected = fixedBranch || "default";
    onChange(nextConfig);
  };

  const applySelectorRules = (
    nextRules: Array<Record<string, unknown>>,
    nextDefault?: string
  ) => {
    const nextConfig = cloneRecord(config);
    delete nextConfig.expression;
    delete nextConfig.selected;
    const nextSelector: Record<string, unknown> = {
      rules: nextRules
    };
    if (nextDefault?.trim()) {
      nextSelector.default = nextDefault.trim();
    }
    nextConfig.selector = nextSelector;
    onChange(nextConfig);
  };

  const updateSelectorRule = (
    index: number,
    patch: Partial<Record<"key" | "path" | "operator" | "value", unknown>>
  ) => {
    const nextRules = rules.map((rule, ruleIndex) =>
      ruleIndex === index
        ? {
            ...rule,
            ...patch
          }
        : rule
    );

    applySelectorRules(
      nextRules,
      typeof selector.default === "string" ? selector.default : undefined
    );
  };

  const removeSelectorRule = (index: number) => {
    if (rules.length <= 1) {
      return;
    }
    const nextRules = rules.filter((_, ruleIndex) => ruleIndex !== index);
    applySelectorRules(
      nextRules,
      typeof selector.default === "string" ? selector.default : undefined
    );
  };

  return (
    <div className="binding-form">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Structured config</p>
          <h3>{node.data.nodeType === "condition" ? "Condition branches" : "Router branches"}</h3>
        </div>
      </div>

      <label className="binding-field">
        <span className="binding-label">Decision mode</span>
        <select
          className="binding-select"
          value={branchMode}
          onChange={(event) => applyBranchMode(event.target.value as BranchMode)}
        >
          <option value="selector">selector rules</option>
          <option value="expression">safe expression</option>
          <option value="fixed">fixed branch</option>
        </select>
      </label>

      {branchMode === "selector" ? (
        <>
          {rules.map((rule, index) => (
            <div className="payload-card compact-card" key={`${node.id}-rule-${index}`}>
              <div className="payload-card-header">
                <span className="status-meta">Rule {index + 1}</span>
              </div>

              <label className="binding-field">
                <span className="binding-label">Key</span>
                <input
                  className="trace-text-input"
                  value={String(rule.key ?? "")}
                  onChange={(event) =>
                    updateSelectorRule(index, {
                      key: event.target.value.trim() || `branch_${index + 1}`
                    })
                  }
                  placeholder="例如 urgent / search"
                />
              </label>

              <label className="binding-field">
                <span className="binding-label">Path</span>
                <input
                  className="trace-text-input"
                  value={String(rule.path ?? "")}
                  onChange={(event) =>
                    updateSelectorRule(index, {
                      path: event.target.value.trim() || "trigger_input.value"
                    })
                  }
                  placeholder="例如 trigger_input.intent"
                />
              </label>

              <label className="binding-field">
                <span className="binding-label">Operator</span>
                <select
                  className="binding-select"
                  value={String(rule.operator ?? "eq")}
                  onChange={(event) =>
                    updateSelectorRule(index, { operator: event.target.value })
                  }
                >
                  {BRANCH_OPERATORS.map((operator) => (
                    <option key={`${node.id}-${index}-${operator}`} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
              </label>

              <label className="binding-field">
                <span className="binding-label">Value</span>
                <input
                  className="trace-text-input"
                  value={formatBranchRuleValue(rule.value)}
                  onChange={(event) =>
                    updateSelectorRule(index, {
                      value: parseBranchRuleValue(event.target.value)
                    })
                  }
                  placeholder='支持字符串或 JSON 字面量，如 "high" / 7 / ["a"]'
                />
              </label>

              <button
                className="editor-danger-button"
                type="button"
                onClick={() => removeSelectorRule(index)}
                disabled={rules.length <= 1}
              >
                删除规则
              </button>
            </div>
          ))}

          <button
            className="sync-button"
            type="button"
            onClick={() =>
              applySelectorRules(
                [...rules, createDefaultBranchRule(node.data.nodeType, rules.length + 1)],
                typeof selector.default === "string" ? selector.default : undefined
              )
            }
          >
            添加规则
          </button>

          <label className="binding-field">
            <span className="binding-label">Default branch</span>
            <input
              className="trace-text-input"
              value={typeof selector.default === "string" ? selector.default : ""}
              onChange={(event) =>
                applySelectorRules(rules, event.target.value || undefined)
              }
              placeholder="为空时沿用默认 fallback edge"
            />
          </label>
        </>
      ) : null}

      {branchMode === "expression" ? (
        <>
          <label className="binding-field">
            <span className="binding-label">Expression</span>
            <textarea
              className="editor-json-area"
              value={expression}
              onChange={(event) => {
                const nextConfig = cloneRecord(config);
                delete nextConfig.selector;
                delete nextConfig.selected;
                nextConfig.expression = event.target.value;
                if (defaultBranch && defaultBranch !== "default") {
                  nextConfig.default = defaultBranch;
                } else {
                  delete nextConfig.default;
                }
                onChange(nextConfig);
              }}
            />
          </label>

          <label className="binding-field">
            <span className="binding-label">Default branch key</span>
            <input
              className="trace-text-input"
              value={defaultBranch === "default" ? "" : defaultBranch}
              onChange={(event) => {
                const nextConfig = cloneRecord(config);
                delete nextConfig.selector;
                delete nextConfig.selected;
                nextConfig.expression = expression;
                if (event.target.value.trim()) {
                  nextConfig.default = event.target.value.trim();
                } else {
                  delete nextConfig.default;
                }
                onChange(nextConfig);
              }}
              placeholder="为空时走 condition/router 的默认 fallback"
            />
          </label>

          <small className="section-copy">
            {node.data.nodeType === "condition"
              ? "condition 节点的 expression 模式建议把出边 condition 约束在 true / false。"
              : "router 节点的 expression 结果会映射到同名出边 condition。"}
          </small>
        </>
      ) : null}

      {branchMode === "fixed" ? (
        <label className="binding-field">
          <span className="binding-label">Selected branch</span>
          <input
            className="trace-text-input"
            value={fixedBranch}
            onChange={(event) => {
              const nextConfig = cloneRecord(config);
              delete nextConfig.selector;
              delete nextConfig.expression;
              delete nextConfig.default;
              nextConfig.selected = event.target.value || "default";
              onChange(nextConfig);
            }}
            placeholder="例如 default / search / true"
          />
        </label>
      ) : null}
    </div>
  );
}
