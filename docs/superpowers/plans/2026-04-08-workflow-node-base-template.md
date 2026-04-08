# Workflow Node Base Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 workflow editor 的所有节点收口到统一基类：共享画布卡片壳、共享 inspector 设置/运行时模板，以及节点特性 slot。

**Architecture:** 先抽 `WorkflowNodeCardShell` 稳住画布节点外壳，再建立 `WorkflowEditorNodePanel + WorkflowNodeTemplateDefinition` 作为 inspector 统一入口，最后把现有 `WorkflowEditorNodeSettingsPanel` 与 `WorkflowEditorNodeRuntimePanel` 收敛成“共享模板 + 节点特性逻辑”结构。`startNode` 只保留“没有上游输入 + trigger schema + cached modal trial-run”这些特性，不再拥有单独一整套 runtime 骨架。

**Tech Stack:** React 19、Next.js App Router、TypeScript、Ant Design 6、`@xyflow/react`、Vitest、全局 CSS

---

## File Structure

- Create: `web/components/workflow-editor-workbench/workflow-node-card-shell.tsx`
  - 统一画布节点外壳，承接标题、图标、状态、动作区、quick-add 和 handles。
- Create: `web/components/workflow-editor-workbench/__tests__/workflow-node-card-shell.test.tsx`
  - 锁住共享卡片壳的公共动作和节点差异语义。
- Modify: `web/components/workflow-editor-workbench/workflow-canvas-node.tsx`
  - 从“直接渲染全部 UI”收敛成“数据适配器 + shell 调用”。
- Create: `web/components/workflow-editor-inspector-panels/workflow-node-template-definition.ts`
  - 集中定义节点模板差异：图标、颜色、settings slot、runtime slot、上游输入语义、试运行语义。
- Create: `web/components/workflow-editor-inspector-panels/workflow-editor-node-panel.tsx`
  - 统一节点详情入口，输出 `设置 / 运行时 / AI` tab。
- Create: `web/components/workflow-editor-inspector-panels/workflow-node-settings-template.tsx`
  - 统一 settings tab 骨架。
- Create: `web/components/workflow-editor-inspector-panels/workflow-node-runtime-template.tsx`
  - 统一 runtime tab 骨架。
- Modify: `web/components/workflow-editor-inspector-panels/workflow-editor-node-settings-panel.tsx`
  - 收敛为 settings 特性 section 与 startNode trigger-field section。
- Modify: `web/components/workflow-editor-inspector-panels/workflow-editor-node-runtime-panel.tsx`
  - 收敛为 runtime 行为适配器，把共享布局迁给 `WorkflowNodeRuntimeTemplate`。
- Modify: `web/components/workflow-editor-inspector.tsx`
  - 改为只挂统一 `WorkflowEditorNodePanel`。
- Modify: `web/components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.test.tsx`
  - 锁住 runtime 模板的公共结构与 `startNode` 特性。
- Modify: `web/components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.client.test.tsx`
  - 锁住 `startNode` modal/cached trial-run 继续可用。
- Modify: `web/components/__tests__/workflow-editor-inspector.test.tsx`
  - 锁住 inspector 改挂统一节点面板后的结构。

### Task 1: Extract the Shared Canvas Node Shell

**Files:**
- Create: `web/components/workflow-editor-workbench/workflow-node-card-shell.tsx`
- Create: `web/components/workflow-editor-workbench/__tests__/workflow-node-card-shell.test.tsx`
- Modify: `web/components/workflow-editor-workbench/workflow-canvas-node.tsx`

- [ ] **Step 1: Write the failing card-shell test**

```tsx
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkflowNodeCardShell } from "@/components/workflow-editor-workbench/workflow-node-card-shell";

Object.assign(globalThis, { React });

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) =>
    createElement("div", {
      "data-component": "handle",
      "data-type": type,
      "data-position": position
    }),
  Position: {
    Left: "left",
    Right: "right"
  }
}));

vi.mock("@/components/workflow-editor-workbench/workflow-canvas-quick-add", () => ({
  WorkflowCanvasQuickAddTrigger: () =>
    createElement("div", { "data-component": "quick-add" }, "quick-add")
}));

describe("WorkflowNodeCardShell", () => {
  it("keeps shared actions while respecting start-node delete rules", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowNodeCardShell, {
        id: "start-node",
        selected: true,
        label: "用户输入",
        typeLabel: "开始",
        meta: "trigger · start",
        glyph: "入",
        accentColor: "#216e4a",
        description: "开始节点",
        hasIncomingHandle: false,
        hasOutgoingHandle: true,
        canDelete: false,
        canQuickAdd: true,
        canOpenRuntime: true,
        quickAddOptions: [],
        onOpenRuntime: () => undefined,
        onDeleteNode: () => undefined,
        onQuickAdd: () => undefined
      })
    );

    expect(html).toContain('data-component="workflow-node-card-shell"');
    expect(html).toContain('data-action="open-node-runtime-from-node"');
    expect(html).toContain("试运行 用户输入");
    expect(html).toContain('data-component="quick-add"');
    expect(html).toContain('data-type="source"');
    expect(html).not.toContain("删除 用户输入");
    expect(html).not.toContain('data-type="target"');
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
cd /home/taichu/git/7flows && corepack pnpm --dir web exec vitest run components/workflow-editor-workbench/__tests__/workflow-node-card-shell.test.tsx --cache=false
```

Expected: FAIL with `Cannot find module "@/components/workflow-editor-workbench/workflow-node-card-shell"` or missing shared shell markup.

- [ ] **Step 3: Implement `WorkflowNodeCardShell` and adapt `WorkflowCanvasNode`**

```tsx
// web/components/workflow-editor-workbench/workflow-node-card-shell.tsx
"use client";

import type { CSSProperties } from "react";
import { Handle, Position } from "@xyflow/react";
import { PlayCircleOutlined } from "@ant-design/icons";

import {
  WorkflowCanvasQuickAddTrigger,
  type WorkflowCanvasQuickAddOption
} from "@/components/workflow-editor-workbench/workflow-canvas-quick-add";

export type WorkflowNodeCardShellProps = {
  id: string;
  selected: boolean;
  label: string;
  typeLabel: string;
  meta: string;
  glyph: string;
  accentColor: string;
  description?: string | null;
  runtimeClassName?: string;
  hasIncomingHandle: boolean;
  hasOutgoingHandle: boolean;
  canDelete: boolean;
  canQuickAdd: boolean;
  canOpenRuntime: boolean;
  quickAddOptions: WorkflowCanvasQuickAddOption[];
  onQuickAdd?: (sourceNodeId: string, type: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onOpenRuntime?: (nodeId: string) => void;
};

export function WorkflowNodeCardShell({
  id,
  selected,
  label,
  typeLabel,
  meta,
  glyph,
  accentColor,
  description,
  runtimeClassName,
  hasIncomingHandle,
  hasOutgoingHandle,
  canDelete,
  canQuickAdd,
  canOpenRuntime,
  quickAddOptions,
  onQuickAdd,
  onDeleteNode,
  onOpenRuntime
}: WorkflowNodeCardShellProps) {
  return (
    <div
      className={`workflow-canvas-node ${selected ? "selected" : ""} ${runtimeClassName ?? ""}`.trim()}
      style={{ "--node-accent": accentColor } as CSSProperties}
      data-component="workflow-node-card-shell"
    >
      {hasIncomingHandle ? <Handle type="target" position={Position.Left} /> : null}
      {selected && (canOpenRuntime || canDelete) ? (
        <div className="workflow-canvas-node-actions">
          {canOpenRuntime ? (
            <button
              className="workflow-canvas-node-action-button"
              type="button"
              aria-label={`试运行 ${label}`}
              data-action="open-node-runtime-from-node"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenRuntime?.(id);
              }}
            >
              <PlayCircleOutlined />
            </button>
          ) : null}
          {canDelete ? (
            <button
              className="workflow-canvas-node-action-button danger"
              type="button"
              aria-label={`删除 ${label}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDeleteNode?.(id);
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="workflow-canvas-node-head">
        <div className="workflow-canvas-node-icon" aria-hidden="true">{glyph}</div>
        <div className="workflow-canvas-node-head-copy">
          <div className="workflow-canvas-node-title-row">
            <div className="workflow-canvas-node-label">{label}</div>
            <span className="workflow-canvas-node-kind">{typeLabel}</span>
          </div>
          <div className="workflow-canvas-node-type">{meta}</div>
        </div>
      </div>
      {description ? <div className="workflow-canvas-node-description">{description}</div> : null}
      {canQuickAdd ? (
        <WorkflowCanvasQuickAddTrigger
          quickAddOptions={quickAddOptions}
          triggerAriaLabel={`${label} 后添加节点`}
          menuTitle="添加下一个节点"
          menuDescription="直接插入当前节点后方，并自动续上主链。"
          containerClassName="workflow-canvas-node-quick-add"
          triggerClassName="workflow-canvas-node-quick-add-trigger"
          menuClassName="workflow-canvas-node-quick-menu"
          onQuickAdd={(type) => onQuickAdd?.(id, type)}
        />
      ) : null}
      {hasOutgoingHandle ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}
```

```tsx
// web/components/workflow-editor-workbench/workflow-canvas-node.tsx
import { WorkflowNodeCardShell } from "@/components/workflow-editor-workbench/workflow-node-card-shell";

export function WorkflowCanvasNode({ id, data, selected, onQuickAdd, onDeleteNode, onOpenRuntime, quickAddOptions = [] }: WorkflowCanvasNodeComponentProps) {
  const resolvedQuickAddOptions = useMemo(
    () => quickAddOptions.filter((item) => item.type !== "startNode"),
    [quickAddOptions]
  );

  return (
    <WorkflowNodeCardShell
      id={id}
      selected={selected}
      label={data.label}
      typeLabel={data.typeLabel ?? data.nodeType}
      meta={formatWorkflowNodeMeta(data.capabilityGroup, data.nodeType, data.typeLabel)}
      glyph={resolveNodeGlyph(data.nodeType)}
      accentColor={nodeColorByType(data.nodeType)}
      description={resolveNodeDescription(data.config)}
      runtimeClassName={data.runStatus ? `runtime-${toCssIdentifier(data.runStatus)}` : ""}
      hasIncomingHandle={data.nodeType !== "startNode"}
      hasOutgoingHandle={data.nodeType !== "endNode"}
      canDelete={data.nodeType !== "startNode"}
      canQuickAdd={Boolean(selected && onQuickAdd && data.nodeType !== "endNode")}
      canOpenRuntime={Boolean(onOpenRuntime)}
      quickAddOptions={resolvedQuickAddOptions}
      onQuickAdd={onQuickAdd}
      onDeleteNode={onDeleteNode}
      onOpenRuntime={onOpenRuntime}
    />
  );
}
```

- [ ] **Step 4: Run the focused canvas-node tests**

Run:

```bash
cd /home/taichu/git/7flows && corepack pnpm --dir web exec vitest run \
  components/workflow-editor-workbench/__tests__/workflow-node-card-shell.test.tsx \
  components/workflow-editor-workbench/__tests__/workflow-canvas-node.test.tsx --cache=false
```

Expected: PASS for the new shell test and the existing canvas-node tests.

- [ ] **Step 5: Commit the canvas-shell slice**

```bash
cd /home/taichu/git/7flows
git add \
  web/components/workflow-editor-workbench/workflow-node-card-shell.tsx \
  web/components/workflow-editor-workbench/workflow-canvas-node.tsx \
  web/components/workflow-editor-workbench/__tests__/workflow-node-card-shell.test.tsx
git commit -m "refactor(workflow): extract canvas node shell"
```

### Task 2: Introduce the Unified Node Panel Entry and Template Definition

**Files:**
- Create: `web/components/workflow-editor-inspector-panels/workflow-node-template-definition.ts`
- Create: `web/components/workflow-editor-inspector-panels/workflow-editor-node-panel.tsx`
- Modify: `web/components/workflow-editor-inspector.tsx`
- Modify: `web/components/__tests__/workflow-editor-inspector.test.tsx`

- [ ] **Step 1: Extend the inspector test to look for the shared node panel**

```tsx
it("routes selected nodes through the shared node panel entry", () => {
  const html = renderToStaticMarkup(
    createElement(WorkflowEditorInspector, {
      ...buildProps(),
      selectedNode: buildSelectedNode()
    })
  );

  expect(html).toContain('data-component="workflow-editor-node-panel"');
  expect(html).toContain("设置");
  expect(html).toContain("运行时");
});

it("keeps start nodes on the same shared node panel entry", () => {
  const triggerNode = buildTriggerNode();
  const html = renderToStaticMarkup(
    createElement(WorkflowEditorInspector, {
      ...buildProps(),
      selectedNode: triggerNode,
      nodes: [triggerNode]
    })
  );

  expect(html).toContain('data-component="workflow-editor-node-panel"');
  expect(html).toContain("设置");
  expect(html).toContain("运行时");
});
```

- [ ] **Step 2: Run the inspector test to verify it fails**

Run:

```bash
cd /home/taichu/git/7flows && corepack pnpm --dir web exec vitest run components/__tests__/workflow-editor-inspector.test.tsx --cache=false
```

Expected: FAIL because the shared panel/data-components do not exist yet.

- [ ] **Step 3: Add the template-definition resolver and unified panel**

```ts
// web/components/workflow-editor-inspector-panels/workflow-node-template-definition.ts
import type { Node } from "@xyflow/react";

import type { WorkflowCanvasNodeData } from "@/lib/workflow-editor";

export type WorkflowNodeTemplateDefinition = {
  nodeType: string;
  hasUpstreamSummary: boolean;
  showsContractInRuntime: boolean;
  settingsMode: "trigger" | "generic";
  runtimeMode: "start" | "generic";
};

export function resolveWorkflowNodeTemplateDefinition(
  node: Node<WorkflowCanvasNodeData>
): WorkflowNodeTemplateDefinition {
  if (node.data.nodeType === "startNode") {
    return {
      nodeType: node.data.nodeType,
      hasUpstreamSummary: false,
      showsContractInRuntime: true,
      settingsMode: "trigger",
      runtimeMode: "start"
    };
  }

  return {
    nodeType: node.data.nodeType,
    hasUpstreamSummary: true,
    showsContractInRuntime: false,
    settingsMode: "generic",
    runtimeMode: "generic"
  };
}
```

```tsx
// web/components/workflow-editor-inspector-panels/workflow-editor-node-panel.tsx
"use client";

import { Tabs } from "antd";
import type { ComponentProps, ReactNode } from "react";

import { WorkflowEditorNodeSettingsPanel } from "@/components/workflow-editor-inspector-panels/workflow-editor-node-settings-panel";
import { WorkflowEditorNodeRuntimePanel } from "@/components/workflow-editor-inspector-panels/workflow-editor-node-runtime-panel";
import { resolveWorkflowNodeTemplateDefinition } from "@/components/workflow-editor-inspector-panels/workflow-node-template-definition";

export type WorkflowEditorNodePanelProps = {
  settingsProps: ComponentProps<typeof WorkflowEditorNodeSettingsPanel>;
  runtimeProps: ComponentProps<typeof WorkflowEditorNodeRuntimePanel>;
  activeTabKey: "node-config" | "node-runtime" | "node-assistant";
  onActiveTabChange: (key: "node-config" | "node-runtime" | "node-assistant") => void;
  assistantTab?: { key: "node-assistant"; label: string; children: ReactNode } | null;
};

export function WorkflowEditorNodePanel({
  settingsProps,
  runtimeProps,
  activeTabKey,
  onActiveTabChange,
  assistantTab = null
}: WorkflowEditorNodePanelProps) {
  const definition = resolveWorkflowNodeTemplateDefinition(settingsProps.node);

  return (
    <div data-component="workflow-editor-node-panel" data-node-type={definition.nodeType}>
      <Tabs
        activeKey={activeTabKey}
        onChange={(key) => onActiveTabChange(key as "node-config" | "node-runtime" | "node-assistant")}
        items={[
          {
            key: "node-config",
            label: "设置",
            children: <WorkflowEditorNodeSettingsPanel {...settingsProps} />
          },
          {
            key: "node-runtime",
            label: "运行时",
            children: <WorkflowEditorNodeRuntimePanel {...runtimeProps} />
          },
          ...(assistantTab ? [assistantTab] : [])
        ]}
      />
    </div>
  );
}
```

```tsx
// web/components/workflow-editor-inspector.tsx
import { WorkflowEditorNodePanel } from "@/components/workflow-editor-inspector-panels/workflow-editor-node-panel";

const nodePanel = selectedNode ? (
  <WorkflowEditorNodePanel
    activeTabKey={activeTabKey}
    onActiveTabChange={(key) => setActiveTabKey(key)}
    settingsProps={{
      node: selectedNode,
      nodes,
      edges,
      tools,
      adapters,
      credentials,
      modelProviderCatalog,
      modelProviderConfigs,
      modelProviderRegistryStatus,
      currentHref,
      sandboxReadiness,
      highlightedNodeSection,
      highlightedNodeFieldPath,
      focusedValidationItem,
      nodeConfigText,
      onNodeConfigTextChange,
      onApplyNodeConfigJson,
      onNodeConfigChange,
      onNodeInputSchemaChange,
      onNodeOutputSchemaChange,
      onNodeRuntimePolicyUpdate,
      onDeleteSelectedNode
    }}
    runtimeProps={{
      workflowId,
      node: selectedNode,
      run,
      currentHref,
      onNodeInputSchemaChange,
      onNodeOutputSchemaChange,
      highlightedNodeSection,
      highlightedNodeFieldPath,
      focusedValidationItem,
      sandboxReadiness,
      runtimeRequest,
      onRunSuccess: onRuntimeRunSuccess,
      onRunError: onRuntimeRunError,
      onRuntimeRequestHandled,
      onOpenRunOverlay
    }}
    assistantTab={supportsAssistantTab ? { key: "node-assistant", label: "AI", children: assistantPanel } : null}
  />
) : null;
```

- [ ] **Step 4: Run the shared-panel inspector tests**

Run:

```bash
cd /home/taichu/git/7flows && corepack pnpm --dir web exec vitest run components/__tests__/workflow-editor-inspector.test.tsx --cache=false
```

Expected: PASS with the inspector now routing node tabs through `workflow-editor-node-panel`.

- [ ] **Step 5: Commit the node-panel slice**

```bash
cd /home/taichu/git/7flows
git add \
  web/components/workflow-editor-inspector-panels/workflow-node-template-definition.ts \
  web/components/workflow-editor-inspector-panels/workflow-editor-node-panel.tsx \
  web/components/workflow-editor-inspector.tsx \
  web/components/__tests__/workflow-editor-inspector.test.tsx
git commit -m "refactor(workflow): add shared node inspector entry"
```

### Task 3: Migrate Settings and Runtime to Shared Templates

**Files:**
- Create: `web/components/workflow-editor-inspector-panels/workflow-node-settings-template.tsx`
- Create: `web/components/workflow-editor-inspector-panels/workflow-node-runtime-template.tsx`
- Modify: `web/components/workflow-editor-inspector-panels/workflow-editor-node-settings-panel.tsx`
- Modify: `web/components/workflow-editor-inspector-panels/workflow-editor-node-runtime-panel.tsx`
- Modify: `web/components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.test.tsx`
- Modify: `web/components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.client.test.tsx`

- [ ] **Step 1: Update runtime tests to expect the shared template markers**

```tsx
it("renders the shared runtime template for non-start nodes", () => {
  const html = renderToStaticMarkup(
    createElement(WorkflowEditorNodeRuntimePanel, {
      workflowId: "workflow-demo",
      node: buildNode({
        label: "LLM Agent",
        nodeType: "llmAgentNode",
        inputSchema: {}
      })
    })
  );

  expect(html).toContain('data-component="workflow-node-runtime-template"');
  expect(html).toContain('data-component="workflow-node-runtime-summary"');
  expect(html).toContain('data-component="workflow-node-runtime-input-section"');
  expect(html).toContain('data-component="workflow-node-runtime-output-section"');
});

it("keeps start-node trial-run behaviour on the shared runtime template", () => {
  const html = renderToStaticMarkup(
    createElement(WorkflowEditorNodeRuntimePanel, {
      workflowId: "workflow-demo",
      node: buildNode({}),
      onNodeInputSchemaChange: () => undefined,
      onNodeOutputSchemaChange: () => undefined
    })
  );

  expect(html).toContain('data-component="workflow-node-runtime-template"');
  expect(html).toContain('data-component="workflow-editor-start-node-runtime-strip"');
  expect(html).toContain('data-component="workflow-editor-node-runtime-contract"');
});
```

```tsx
it("still runs immediately from cached start-node payloads after the template refactor", async () => {
  window.localStorage.setItem(
    "sevenflows.editor.start-node-trial-run:workflow-demo:node-1",
    JSON.stringify({ query: "缓存值" })
  );

  await act(async () => {
    root?.render(
      createElement(WorkflowEditorNodeRuntimePanel, {
        workflowId: "workflow-demo",
        node: buildNode({}),
        runtimeRequest: buildRuntimeRequest()
      })
    );
  });

  expect(document.body.innerHTML).toContain('data-component="workflow-node-runtime-template"');
  expect(triggerWorkflowNodeTrialRunMock).toHaveBeenCalledWith(
    "workflow-demo",
    "node-1",
    { query: "缓存值" }
  );
});
```

- [ ] **Step 2: Run the runtime tests to verify they fail**

Run:

```bash
cd /home/taichu/git/7flows && corepack pnpm --dir web exec vitest run \
  components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.test.tsx \
  components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.client.test.tsx --cache=false
```

Expected: FAIL because the shared template components and markers do not exist yet.

- [ ] **Step 3: Implement the shared settings/runtime templates and rewire the two panels**

```tsx
// web/components/workflow-editor-inspector-panels/workflow-node-settings-template.tsx
"use client";

import type { ReactNode } from "react";
import { Collapse, Space } from "antd";

export type WorkflowNodeSettingsTemplateProps = {
  featureSection: ReactNode;
  contractSection?: ReactNode;
  runtimePolicySection?: ReactNode;
  rawJsonSection?: ReactNode;
  showAdvanced: boolean;
  expandedSectionKeys: string[];
  onExpandedSectionKeysChange: (keys: string[]) => void;
};

export function WorkflowNodeSettingsTemplate({
  featureSection,
  contractSection,
  runtimePolicySection,
  rawJsonSection,
  showAdvanced,
  expandedSectionKeys,
  onExpandedSectionKeysChange
}: WorkflowNodeSettingsTemplateProps) {
  if (!showAdvanced) {
    return (
      <Space
        orientation="vertical"
        size={20}
        style={{ width: "100%" }}
        data-component="workflow-node-settings-template"
      >
        {featureSection}
      </Space>
    );
  }

  return (
    <Space
      orientation="vertical"
      size={20}
      style={{ width: "100%" }}
      data-component="workflow-node-settings-template"
    >
      {featureSection}
      <Collapse
        activeKey={expandedSectionKeys}
        onChange={(keys) => onExpandedSectionKeysChange(Array.isArray(keys) ? keys.map(String) : [String(keys)])}
        items={[
          {
            key: "advanced",
            label: "高级设置",
            children: (
              <Space orientation="vertical" size={20} style={{ width: "100%" }}>
                {contractSection}
                {runtimePolicySection}
              </Space>
            )
          },
          {
            key: "json",
            label: "原始 JSON",
            children: rawJsonSection
          }
        ]}
      />
    </Space>
  );
}
```

```tsx
// web/components/workflow-editor-inspector-panels/workflow-node-runtime-template.tsx
"use client";

import type { ReactNode } from "react";
import { Space } from "antd";

export type WorkflowNodeRuntimeTemplateProps = {
  summarySection: ReactNode;
  inputSection?: ReactNode;
  trialRunSection?: ReactNode;
  outputSection?: ReactNode;
  contractSection?: ReactNode;
};

export function WorkflowNodeRuntimeTemplate({
  summarySection,
  inputSection,
  trialRunSection,
  outputSection,
  contractSection
}: WorkflowNodeRuntimeTemplateProps) {
  return (
    <Space
      orientation="vertical"
      size={24}
      style={{ width: "100%" }}
      data-component="workflow-node-runtime-template"
    >
      <div data-component="workflow-node-runtime-summary">{summarySection}</div>
      {inputSection ? <div data-component="workflow-node-runtime-input-section">{inputSection}</div> : null}
      {trialRunSection ? <div data-component="workflow-node-runtime-trial-section">{trialRunSection}</div> : null}
      {outputSection ? <div data-component="workflow-node-runtime-output-section">{outputSection}</div> : null}
      {contractSection}
    </Space>
  );
}
```

```tsx
// web/components/workflow-editor-inspector-panels/workflow-editor-node-settings-panel.tsx
import { WorkflowNodeSettingsTemplate } from "@/components/workflow-editor-inspector-panels/workflow-node-settings-template";
import { resolveWorkflowNodeTemplateDefinition } from "@/components/workflow-editor-inspector-panels/workflow-node-template-definition";

export function WorkflowEditorNodeSettingsPanel(props: WorkflowEditorNodeSettingsPanelProps) {
  const definition = resolveWorkflowNodeTemplateDefinition(props.node);

  const featureSection =
    definition.settingsMode === "trigger" ? (
      <WorkflowEditorTriggerInputFieldsSection
        node={props.node}
        downstreamNodes={downstreamNodes}
        onNodeInputSchemaChange={props.onNodeInputSchemaChange}
      />
    ) : (
      <div data-component="workflow-editor-node-settings-primary">
        <WorkflowNodeConfigForm
          node={props.node}
          nodes={props.nodes}
          tools={props.tools}
          adapters={props.adapters}
          credentials={props.credentials}
          modelProviderCatalog={props.modelProviderCatalog}
          modelProviderConfigs={props.modelProviderConfigs}
          modelProviderRegistryStatus={props.modelProviderRegistryStatus}
          currentHref={props.currentHref}
          sandboxReadiness={props.sandboxReadiness}
          highlightedFieldPath={
            props.highlightedNodeSection === "config" ? props.highlightedNodeFieldPath : null
          }
          focusedValidationItem={
            props.highlightedNodeSection === "config" ? props.focusedValidationItem : null
          }
          onChange={props.onNodeConfigChange}
        />
      </div>
    );

  return (
    <WorkflowNodeSettingsTemplate
      featureSection={featureSection}
      contractSection={
        definition.settingsMode === "generic" ? (
          <WorkflowNodeIoSchemaForm
            node={props.node}
            currentHref={props.currentHref}
            onInputSchemaChange={props.onNodeInputSchemaChange}
            onOutputSchemaChange={props.onNodeOutputSchemaChange}
            highlighted={props.highlightedNodeSection === "contract"}
            highlightedFieldPath={
              props.highlightedNodeSection === "contract" ? props.highlightedNodeFieldPath : null
            }
            focusedValidationItem={
              props.highlightedNodeSection === "contract" ? props.focusedValidationItem : null
            }
            sandboxReadiness={props.sandboxReadiness}
          />
        ) : null
      }
      runtimePolicySection={
        definition.settingsMode === "generic" ? (
          <WorkflowNodeRuntimePolicyForm
            node={props.node}
            nodes={props.nodes}
            edges={props.edges}
            currentHref={props.currentHref}
            onChange={props.onNodeRuntimePolicyUpdate}
            highlighted={props.highlightedNodeSection === "runtime"}
            highlightedFieldPath={
              props.highlightedNodeSection === "runtime" ? props.highlightedNodeFieldPath : null
            }
            focusedValidationItem={
              props.highlightedNodeSection === "runtime" ? props.focusedValidationItem : null
            }
            sandboxReadiness={props.sandboxReadiness}
          />
        ) : null
      }
      rawJsonSection={
        definition.settingsMode === "generic" ? (
          <WorkflowEditorJsonPanel
            nodeConfigText={props.nodeConfigText}
            onNodeConfigTextChange={props.onNodeConfigTextChange}
            onApplyNodeConfigJson={props.onApplyNodeConfigJson}
            onDeleteSelectedNode={props.onDeleteSelectedNode}
          />
        ) : null
      }
      showAdvanced={definition.settingsMode === "generic"}
      expandedSectionKeys={expandedSectionKeys}
      onExpandedSectionKeysChange={setExpandedSectionKeys}
    />
  );
}
```

```tsx
// web/components/workflow-editor-inspector-panels/workflow-editor-node-runtime-panel.tsx
import { WorkflowNodeRuntimeTemplate } from "@/components/workflow-editor-inspector-panels/workflow-node-runtime-template";
import { resolveWorkflowNodeTemplateDefinition } from "@/components/workflow-editor-inspector-panels/workflow-node-template-definition";

export function WorkflowEditorNodeRuntimePanel(props: WorkflowEditorNodeRuntimePanelProps) {
  const definition = resolveWorkflowNodeTemplateDefinition(props.node);
  const summarySection = isStartNode ? (
    <div
      className={`workflow-editor-runtime-summary-card workflow-editor-runtime-summary-card-compact`}
      data-component="workflow-editor-start-node-runtime-summary"
    >
      <div
        className={`workflow-editor-runtime-summary-strip workflow-editor-runtime-summary-strip-${startNodeRuntimeSurface.tone}`}
        data-component="workflow-editor-start-node-runtime-strip"
      >
        <div className="workflow-editor-runtime-summary-strip-main">
          <span className={`health-pill ${startNodeRuntimeSurface.tone}`}>
            {startNodeRuntimeSurface.statusLabel}
          </span>
          <div className="workflow-editor-runtime-summary-strip-meta">
            {startNodeRuntimeResultRunId ? (
              <span className="workflow-canvas-node-meta">
                {formatCompactRunId(startNodeRuntimeResultRunId)}
              </span>
            ) : null}
            {startNodeRuntimeSurface.lastEventType ? (
              <span className="workflow-canvas-node-meta">
                {startNodeRuntimeSurface.lastEventType}
              </span>
            ) : null}
            <span className="workflow-canvas-node-meta">
              运行时间 {formatCompactRuntimeDuration(startNodeRuntimeSurface.durationMs)}
            </span>
            <span className="workflow-canvas-node-meta">
              事件 {formatCompactRuntimeEventCount(startNodeRuntimeSurface.eventCount)}
            </span>
          </div>
        </div>
      </div>
      {startNodeRuntimeSurface.errorMessage ? (
        <Alert
          type="error"
          showIcon
          title="最近一次运行返回错误"
          description={startNodeRuntimeSurface.errorMessage}
        />
      ) : null}
    </div>
  ) : (
    <div className="workflow-editor-runtime-summary-card">
      <div>
        <Text className="workflow-editor-trigger-fields-eyebrow">Runtime</Text>
        <Title level={5} style={{ margin: "4px 0 0" }}>
          当前节点运行态
        </Title>
        <Text type="secondary">
          这里承接节点最近一次运行反馈。试运行会把当前节点包装成最小 7Flows IR 执行，并把结果写入
          `runs / node_runs / run_events`。
        </Text>
      </div>
      <div className="workflow-editor-runtime-summary-grid">
        <div className="workflow-editor-runtime-summary-item">
          <span>状态</span>
          <strong>{props.node.data.runStatus ?? "尚无 node run"}</strong>
        </div>
        <div className="workflow-editor-runtime-summary-item">
          <span>Node run</span>
          <strong>{props.node.data.runNodeId ?? "n/a"}</strong>
        </div>
        <div className="workflow-editor-runtime-summary-item">
          <span>耗时</span>
          <strong>{formatDurationMs(props.node.data.runDurationMs)}</strong>
        </div>
        <div className="workflow-editor-runtime-summary-item">
          <span>事件</span>
          <strong>
            {typeof props.node.data.runEventCount === "number" ? props.node.data.runEventCount : "n/a"}
          </strong>
        </div>
      </div>
      {props.node.data.runLastEventType ? (
        <Text type="secondary">最近事件：{props.node.data.runLastEventType}</Text>
      ) : null}
      {props.onOpenRunOverlay ? (
        <div className="workflow-editor-trigger-fields-actions">
          <Button onClick={props.onOpenRunOverlay}>打开运行面板</Button>
          {lastTriggeredRunId ? (
            <Text type="secondary">最近试运行的 run: {lastTriggeredRunId}</Text>
          ) : null}
        </div>
      ) : null}
    </div>
  );
  const inputSection = definition.hasUpstreamSummary ? (
    <div className="workflow-editor-runtime-form-card">
      <div className="workflow-editor-inspector-section">
        <div className="workflow-editor-inspector-section-title">上游输入与试运行说明</div>
        <Text type="secondary">
          当前节点存在上游连线，但单节点试运行只接受本次直接输入，不自动补齐原工作流上游节点的真实 context。
        </Text>
      </div>
    </div>
  ) : null;
  const trialRunSection = isStartNode ? (
    startNodeRuntimeSurface.showLoadingPanel ? (
      <div
        className="workflow-editor-runtime-form-card"
        data-component="workflow-editor-start-node-runtime-loading"
      >
        <div className="workflow-editor-runtime-modal-loading">
          <Spin size="small" />
          <Text type="secondary">{startNodeRuntimeSurface.loadingMessage}</Text>
        </div>
      </div>
    ) : null
  ) : (
    <div className="workflow-editor-runtime-form-card">
      <div className="workflow-editor-inspector-section">
        <div className="workflow-editor-inspector-section-title">试运行输入</div>
        <Text type="secondary">
          这里只提供本次试运行的直接输入，不自动补齐原工作流上游节点的真实 context。
          要查看完整链路，请继续从整条 workflow 的运行入口发起执行。
        </Text>
      </div>
      {renderTrialRunForm({ includeInlineActions: true })}
    </div>
  );
  const outputSection = isStartNode ? (
    <>
      {statusMessage?.type === "error" ? (
        <Alert type="error" showIcon title="试运行失败" description={statusMessage.text} />
      ) : null}
      {trialRunDetailMessage && !startNodeRuntimeSurface.showLoadingPanel ? (
        <Alert type="info" showIcon description={trialRunDetailMessage} />
      ) : null}
    </>
  ) : (
    renderGenericRuntimeResults()
  );

  return (
    <>
      <WorkflowNodeRuntimeTemplate
        summarySection={summarySection}
        inputSection={inputSection}
        trialRunSection={trialRunSection}
        outputSection={outputSection}
        contractSection={
          definition.showsContractInRuntime &&
          props.onNodeInputSchemaChange &&
          props.onNodeOutputSchemaChange ? (
            <div
              className="workflow-editor-runtime-form-card"
              data-component="workflow-editor-node-runtime-contract"
            >
              <WorkflowNodeIoSchemaForm
                node={props.node}
                currentHref={props.currentHref}
                onInputSchemaChange={props.onNodeInputSchemaChange}
                onOutputSchemaChange={props.onNodeOutputSchemaChange}
                highlighted={props.highlightedNodeSection === "contract"}
                highlightedFieldPath={
                  props.highlightedNodeSection === "contract" ? props.highlightedNodeFieldPath : null
                }
                focusedValidationItem={
                  props.highlightedNodeSection === "contract" ? props.focusedValidationItem : null
                }
                sandboxReadiness={props.sandboxReadiness}
                presentation="collapsible"
              />
            </div>
          ) : null
        }
      />
      {isStartNode ? (
        <Modal
          open={isTrialRunModalOpen}
          title="试运行"
          forceRender={typeof window !== "undefined"}
          footer={modalFooter}
          onCancel={() => {
            setIsTrialRunModalOpen(false);
            setIsStartNodeTrialRunSubmitting(false);
          }}
          destroyOnHidden={false}
        >
          {renderTrialRunForm({ includeInlineActions: false })}
        </Modal>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Run the full targeted frontend verification for the shared node templates**

Run:

```bash
cd /home/taichu/git/7flows && corepack pnpm --dir web exec vitest run \
  components/workflow-editor-workbench/__tests__/workflow-node-card-shell.test.tsx \
  components/workflow-editor-workbench/__tests__/workflow-canvas-node.test.tsx \
  components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.test.tsx \
  components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.client.test.tsx \
  components/__tests__/workflow-editor-inspector.test.tsx --cache=false
corepack pnpm --dir web lint
corepack pnpm --dir web exec tsc --noEmit --incremental false
```

Expected:

- targeted Vitest suites PASS
- `next lint` exits `0`
- `tsc --noEmit --incremental false` exits `0`

- [ ] **Step 5: Commit the template migration**

```bash
cd /home/taichu/git/7flows
git add \
  web/components/workflow-editor-inspector-panels/workflow-node-settings-template.tsx \
  web/components/workflow-editor-inspector-panels/workflow-node-runtime-template.tsx \
  web/components/workflow-editor-inspector-panels/workflow-editor-node-settings-panel.tsx \
  web/components/workflow-editor-inspector-panels/workflow-editor-node-runtime-panel.tsx \
  web/components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.test.tsx \
  web/components/workflow-editor-inspector-panels/__tests__/workflow-editor-node-runtime-panel.client.test.tsx \
  web/components/__tests__/workflow-editor-inspector.test.tsx
git commit -m "refactor(workflow): unify node settings and runtime templates"
```

### Task 4: Close Out the Branch

**Files:**
- Modify: `docs/.private/runtime-foundation.md` if the local ledger needs the new active phase recorded
- Verify: `git status`, `git log --oneline -5`

- [ ] **Step 1: Confirm the worktree is clean except expected changes**

Run:

```bash
cd /home/taichu/git/7flows && git status --short
```

Expected: no unexpected modified files outside the node-template slice.

- [ ] **Step 2: Push the branch**

Run:

```bash
cd /home/taichu/git/7flows && git push origin taichuy_dev
```

Expected: push succeeds; if it fails because of auth/network/protection, record the exact reason in the final handoff.

- [ ] **Step 3: Summarize verification evidence in the final handoff**

Include:

```text
- shared canvas shell extracted and covered by focused tests
- inspector now routes selected nodes through workflow-editor-node-panel
- startNode still supports cached modal trial-run after the runtime-template refactor
- lint / tsc / targeted vitest results
- push result or blocker
```
