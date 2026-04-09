"use client";

import React from "react";
import { useMemo, useState } from "react";

import type {
  WorkflowVariableReferenceGroup,
  WorkflowVariableReferenceItem,
} from "@/components/workflow-node-config-form/workflow-variable-text-document";

type WorkflowVariableReferencePickerProps = {
  groups: WorkflowVariableReferenceGroup[];
  onInsert: (selector: string[]) => void;
  onCopyMachineName: (machineName: string) => void;
};

function filterReferenceItem(
  item: WorkflowVariableReferenceItem,
  normalizedQuery: string,
): WorkflowVariableReferenceItem | null {
  const visibleChildren = item.children
    ?.map((child) => filterReferenceItem(child, normalizedQuery))
    .filter((child): child is WorkflowVariableReferenceItem => child !== null);
  const matchesSelf =
    item.label.toLowerCase().includes(normalizedQuery) ||
    item.previewPath.toLowerCase().includes(normalizedQuery);

  if (!matchesSelf && (!visibleChildren || visibleChildren.length === 0)) {
    return null;
  }

  if (!visibleChildren || visibleChildren.length === 0) {
    return item;
  }

  return {
    ...item,
    children: visibleChildren,
  };
}

function ReferenceItemNode({
  item,
  onInsert,
  onCopyMachineName,
}: {
  item: WorkflowVariableReferenceItem;
  onInsert: (selector: string[]) => void;
  onCopyMachineName: (machineName: string) => void;
}) {
  if (item.children && item.children.length > 0) {
    return (
      <details
        className="workflow-variable-reference-tree-node"
        data-component="workflow-variable-reference-branch"
        open
      >
        <summary>{item.label}</summary>
        <div className="workflow-variable-reference-tree-children">
          {item.children.map((child) => (
            <ReferenceItemNode
              key={child.key}
              item={child}
              onInsert={onInsert}
              onCopyMachineName={onCopyMachineName}
            />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="workflow-variable-reference-item" data-component="workflow-variable-picker-item">
      <div className="workflow-variable-reference-item-main">
        <button type="button" className="sync-button" onClick={() => onInsert(item.selector)}>
          {item.label}
        </button>
        <code>{item.previewPath}</code>
      </div>
      <div className="tool-badge-row">
        <button
          type="button"
          className="sync-button secondary"
          onClick={() => onCopyMachineName(item.machineName)}
        >
          复制机器别名
        </button>
      </div>
    </div>
  );
}

export function WorkflowVariableReferencePicker({
  groups,
  onInsert,
  onCopyMachineName,
}: WorkflowVariableReferencePickerProps) {
  const [query, setQuery] = useState("");

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => filterReferenceItem(item, normalizedQuery))
          .filter((item): item is WorkflowVariableReferenceItem => item !== null),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  return (
    <div
      className="binding-help compact-stack workflow-variable-reference-picker"
      data-component="workflow-variable-reference-picker"
    >
      <input
        className="trace-text-input"
        value={query}
        onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
        placeholder="搜索变量或路径"
      />
      {visibleGroups.length > 0 ? (
        visibleGroups.map((group) => (
          <details
            key={group.key}
            className="workflow-variable-reference-group"
            data-component="workflow-variable-reference-group"
            open
          >
            <summary>{group.label}</summary>
            <div className="workflow-variable-reference-group-items">
              {group.items.map((item) => (
                <ReferenceItemNode
                  key={item.key}
                  item={item}
                  onInsert={onInsert}
                  onCopyMachineName={onCopyMachineName}
                />
              ))}
            </div>
          </details>
        ))
      ) : (
        <small className="section-copy">没有匹配到可插入的变量。</small>
      )}
    </div>
  );
}
