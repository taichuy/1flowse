"use client";

import React, { useMemo, useState } from "react";

import type {
  WorkflowVariableReferenceGroup,
  WorkflowVariableReferenceItem,
} from "@/components/workflow-node-config-form/workflow-variable-text-document";

type FlatWorkflowVariableReferenceItem = WorkflowVariableReferenceItem & {
  groupLabel: string;
};

function flattenReferenceItems(
  items: WorkflowVariableReferenceItem[],
  groupLabel: string,
): FlatWorkflowVariableReferenceItem[] {
  return items.flatMap((item) => {
    if (item.children && item.children.length > 0) {
      return flattenReferenceItems(item.children, groupLabel);
    }

    return [{ ...item, groupLabel }];
  });
}

export function WorkflowVariableReferencePicker({
  groups,
  onInsert,
}: {
  groups: WorkflowVariableReferenceGroup[];
  onInsert: (selector: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return groups
      .map((group) => ({
        key: group.key,
        label: group.label,
        items: flattenReferenceItems(group.items, group.label).filter((item) => {
          if (!normalizedQuery) {
            return true;
          }

          return `${item.label} ${item.previewPath}`.toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  return (
    <div
      className="workflow-variable-reference-popover"
      data-component="workflow-variable-reference-popover"
    >
      <label className="workflow-variable-reference-popover-search">
        <span>搜索变量</span>
        <input
          className="trace-text-input"
          value={query}
          onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
          placeholder="搜索变量"
        />
      </label>
      <div className="workflow-variable-reference-popover-body">
        {visibleGroups.length > 0 ? (
          visibleGroups.map((group) => (
            <section key={group.key} className="workflow-variable-reference-popover-group">
              <strong>{group.label}</strong>
              <div className="workflow-variable-reference-popover-items">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="workflow-variable-reference-popover-item"
                    onClick={() => onInsert(item.selector)}
                  >
                    <span className="workflow-variable-reference-popover-item-main">
                      <span>{item.label}</span>
                      <small>{item.previewPath}</small>
                    </span>
                    <span className="workflow-variable-reference-popover-item-type">
                      {item.valueTypeLabel ?? "Value"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <small className="section-copy">没有匹配到可插入的变量。</small>
        )}
      </div>
    </div>
  );
}
