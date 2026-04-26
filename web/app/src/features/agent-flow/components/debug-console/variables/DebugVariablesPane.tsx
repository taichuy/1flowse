import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Collapse, Empty, Input, Tooltip, Typography } from 'antd';

import type { AgentFlowVariableGroup } from '../../../api/runtime';

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function parseEditableValue(rawValue: string): unknown {
  if (rawValue === '') {
    return '';
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

export interface SelectedVariableInfo {
  label: string;
  value: unknown;
  key: string;
}

const DEFAULT_SIDEBAR_WIDTH = 270;
const MIN_SIDEBAR_WIDTH = 140;

export function DebugVariablesPane({
  groups,
  onSelectedChange,
  onSelectedValueChange,
  sidebarWidth,
  sidebarMinWidth,
  sidebarMaxWidth,
  onSidebarResizeStart,
}: {
  groups: AgentFlowVariableGroup[];
  onSelectedChange?: (info: SelectedVariableInfo | null) => void;
  onSelectedValueChange?: (key: string, value: unknown) => void;
  sidebarWidth?: number;
  sidebarMinWidth?: number;
  sidebarMaxWidth?: number;
  onSidebarResizeStart?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedValueText, setSelectedValueText] = useState('');
  const effectiveSidebarWidth = useMemo(() => {
    const minWidth = sidebarMinWidth ?? MIN_SIDEBAR_WIDTH;
    const maxWidth = sidebarMaxWidth ?? Number.POSITIVE_INFINITY;
    const baseWidth = sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;

    return Math.max(minWidth, Math.min(baseWidth, maxWidth));
  }, [sidebarWidth, sidebarMaxWidth, sidebarMinWidth]);
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const selectedItem = useMemo(
    () => (selectedKey ? allItems.find((i) => i.key === selectedKey) : null),
    [selectedKey, allItems]
  );

  useEffect(() => {
    const nextKey = allItems.at(0)?.key ?? null;

    if (allItems.length === 0) {
      if (selectedKey !== null) {
        setSelectedKey(null);
      }
      return;
    }

    if (selectedKey === null) {
      setSelectedKey(nextKey);
      return;
    }

    const exists = allItems.some((item) => item.key === selectedKey);
    if (!exists) {
      setSelectedKey(nextKey);
    }
  }, [allItems, selectedKey]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedValueText('');
      return;
    }

    setSelectedValueText(formatValue(selectedItem.value));
  }, [selectedItem]);

  // 通知父级选中项变化
  useEffect(() => {
    if (selectedItem) {
      onSelectedChange?.({
        label: selectedItem.label,
        value: selectedItem.value,
        key: selectedItem.key
      });
    } else {
      onSelectedChange?.(null);
    }
  }, [selectedKey, selectedItem, onSelectedChange]);

  function handleVariableValueBlur() {
    if (!selectedItem) {
      return;
    }

    const nextValue = parseEditableValue(selectedValueText);

    onSelectedValueChange?.(selectedItem.key, nextValue);
  }

  if (groups.length === 0) {
    return (
      <div className="agent-flow-editor__debug-console-pane">
        <Empty description="当前还没有变量快照" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const defaultGroupKeys = groups.map((group, index) => `${index}:${group.title}`);

  return (
    <div className="agent-flow-editor__debug-console-pane agent-flow-editor__debug-variables-pane">
      <div
        className="agent-flow-editor__debug-variables-sidebar"
        style={{ width: effectiveSidebarWidth }}
        data-testid="agent-flow-editor-variable-cache-sidebar"
      >
        <Collapse
          defaultActiveKey={defaultGroupKeys}
          expandIconPosition="end"
          className="agent-flow-editor__debug-variables-collapse"
          ghost
          size="small"
          items={groups.map((group, groupIndex) => {
            const groupKey = `${groupIndex}:${group.title}`;

            return {
              key: groupKey,
              label: (
                <Typography.Text
                  ellipsis={{ tooltip: false }}
                  className="agent-flow-editor__debug-variables-group-title"
                >
                  {group.title}
                </Typography.Text>
              ),
              children: (
                <div className="agent-flow-editor__debug-variables-group">
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      className={`agent-flow-editor__debug-variables-item ${
                        selectedKey === item.key ? 'is-selected' : ''
                      }`}
                      onClick={() => setSelectedKey(item.key)}
                    >
                      <Tooltip title={item.label} placement="top">
                        <Typography.Text ellipsis={{ tooltip: false }}>
                          {item.label}
                        </Typography.Text>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )
            };
          })}
        />
      </div>
      <div
        aria-label="调整变量列表宽度"
        aria-orientation="vertical"
        className="agent-flow-editor__debug-variables-resize-handle"
        onMouseDown={onSidebarResizeStart}
        role="separator"
      />
      <div className="agent-flow-editor__debug-variables-detail">
        {selectedItem ? (
          <Input.TextArea
            style={{ height: '100%' }}
            aria-label="变量值编辑框"
            className="agent-flow-editor__debug-variables-detail-value"
            onBlur={handleVariableValueBlur}
            onChange={(event) => setSelectedValueText(event.target.value)}
            value={selectedValueText}
          />
        ) : (
          <div className="agent-flow-editor__debug-variables-detail-empty">
            <Empty description="选择左侧变量查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </div>
    </div>
  );
}
