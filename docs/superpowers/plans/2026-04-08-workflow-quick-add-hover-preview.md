# Workflow Quick Add Hover Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 workflow editor 画布 quick-add 菜单改成紧凑单列名称列表，并在 hover / focus 时于右侧浮出独立预览卡，降低默认视觉占用并保留现有插入节点能力。

**Architecture:** 继续沿用现有 `WorkflowCanvasQuickAddTrigger` 作为节点和边上的统一 quick-add 入口，只在组件内部增加当前 preview item 状态和独立悬浮预览卡，不向 graph / shell 泄漏新状态。测试侧新增一份 client DOM 用例锁住“默认无预览、hover / focus 才显示、搜索过滤后预览失效即隐藏、点击插入关闭菜单”的行为，再用 CSS 把大面板收回窄单列菜单。

**Tech Stack:** React 19 client component、Next.js app router、Vitest、React DOM test utils、全局 CSS

---

## File Structure

- Modify: `web/components/workflow-editor-workbench/workflow-canvas-quick-add.tsx`
  - quick-add 组件本体，增加 preview item 状态、预览失效隐藏逻辑和独立悬浮预览 DOM。
- Create: `web/components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.client.test.tsx`
  - 使用真实 DOM 验证 quick-add 的 hover / focus / search / click 行为。
- Modify: `web/app/globals.css`
  - 把 quick-add 收回窄单列菜单，补右侧独立预览卡和响应式样式。

### Task 1: Lock Quick-Add Hover Preview Behavior with a Client Test

**Files:**
- Create: `web/components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.client.test.tsx`
- Modify: `web/components/workflow-editor-workbench/workflow-canvas-quick-add.tsx`

- [ ] **Step 1: Write the failing client test**

```tsx
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowCanvasQuickAddTrigger } from "@/components/workflow-editor-workbench/workflow-canvas-quick-add";

const QUICK_ADD_OPTIONS = [
  {
    type: "llmAgentNode",
    label: "LLM Agent",
    description: "让 agent 继续推理。",
    capabilityGroup: "agent"
  },
  {
    type: "conditionNode",
    label: "Condition",
    description: "按条件分支继续主链。",
    capabilityGroup: "logic"
  },
  {
    type: "toolNode",
    label: "Tool",
    description: "调用工具目录中的能力。",
    capabilityGroup: "integration"
  }
] as const;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

function renderQuickAdd(onQuickAdd = vi.fn()) {
  act(() => {
    root?.render(
      <WorkflowCanvasQuickAddTrigger
        quickAddOptions={[...QUICK_ADD_OPTIONS]}
        triggerAriaLabel="添加节点"
        menuTitle="添加节点"
        menuDescription="直接插入当前节点后方，并自动续上主链。"
        containerClassName="test-shell"
        triggerClassName="test-trigger"
        onQuickAdd={onQuickAdd}
      />
    );
  });

  const trigger = container?.querySelector('button[aria-label="添加节点"]') as HTMLButtonElement;
  act(() => {
    trigger.click();
  });

  return { onQuickAdd, trigger };
}

describe("WorkflowCanvasQuickAddTrigger", () => {
  it("shows the first filtered item in the preview by default and switches on hover", () => {
    renderQuickAdd();

    expect(container?.textContent).toContain("LLM Agent");
    expect(container?.textContent).toContain("让 agent 继续推理。");

    const conditionButton = container?.querySelector(
      'button[aria-label="插入 Condition"]'
    ) as HTMLButtonElement;

    act(() => {
      conditionButton.dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    });

    expect(container?.textContent).toContain("按条件分支继续主链。");
  });

  it("updates the preview on focus, resets to the first matching item after search, and closes after insert", () => {
    const { onQuickAdd } = renderQuickAdd();

    const toolTab = container?.querySelector('button[role="tab"][aria-selected="false"]') as HTMLButtonElement;
    act(() => {
      toolTab.click();
    });

    expect(container?.textContent).toContain("调用工具目录中的能力。");

    const searchInput = container?.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => {
      searchInput.value = "cond";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container?.textContent).toContain("Condition");
    expect(container?.textContent).toContain("按条件分支继续主链。");

    const conditionButton = container?.querySelector(
      'button[aria-label="插入 Condition"]'
    ) as HTMLButtonElement;

    act(() => {
      conditionButton.focus();
      conditionButton.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      conditionButton.click();
    });

    expect(onQuickAdd).toHaveBeenCalledWith("conditionNode");
    expect(container?.querySelector('[role="menu"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails against the current single-column implementation**

Run:

```bash
cd /home/taichu/git/7flows/web && corepack pnpm exec vitest run components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.client.test.tsx --cache=false
```

Expected: FAIL because the current component does not render a dedicated preview panel or update preview state on hover / focus.

- [ ] **Step 3: Commit the failing test before implementation**

```bash
cd /home/taichu/git/7flows
git add web/components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.client.test.tsx
git commit -m "test(workflow): lock quick add hover preview behavior"
```

### Task 2: Implement the Dual-Column Quick-Add Menu and Responsive Styles

**Files:**
- Modify: `web/components/workflow-editor-workbench/workflow-canvas-quick-add.tsx`
- Modify: `web/app/globals.css`
- Test: `web/components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.client.test.tsx`

- [ ] **Step 1: Add preview state and filtered-item fallback logic to the quick-add component**

```tsx
const [previewType, setPreviewType] = useState<string | null>(null);

const flattenedActiveItems = useMemo(
  () => activeSections.flatMap((section) => section.items),
  [activeSections]
);

useEffect(() => {
  if (flattenedActiveItems.length === 0) {
    setPreviewType(null);
    return;
  }

  if (previewType && flattenedActiveItems.some((item) => item.type === previewType)) {
    return;
  }

  setPreviewType(flattenedActiveItems[0]?.type ?? null);
}, [flattenedActiveItems, previewType]);

const previewItem = useMemo(
  () => flattenedActiveItems.find((item) => item.type === previewType) ?? flattenedActiveItems[0] ?? null,
  [flattenedActiveItems, previewType]
);
```

- [ ] **Step 2: Replace the single-column option body with a compact list plus side preview**

```tsx
<div className="workflow-canvas-quick-add-body">
  <div className="workflow-canvas-quick-add-menu-list">
    {activeSections.map((section) => (
      <section className="workflow-canvas-quick-add-section" key={section.key}>
        <div className="workflow-canvas-quick-add-section-label">{section.label}</div>
        <div className="workflow-canvas-quick-add-section-list">
          {section.items.map((item) => {
            const isPreviewing = item.type === previewItem?.type;

            return (
              <button
                className={joinClassNames(
                  "workflow-canvas-quick-add-option",
                  isPreviewing ? "previewing" : null,
                  CANVAS_INTERACTION_GUARD_CLASS_NAME
                )}
                key={item.type}
                type="button"
                role="menuitem"
                aria-label={`插入 ${item.label}`}
                onPointerDown={stopCanvasInteraction}
                onPointerEnter={() => setPreviewType(item.type)}
                onFocus={() => setPreviewType(item.type)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onQuickAdd(item.type);
                  closeMenu();
                }}
              >
                <span className="workflow-canvas-quick-add-option-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    ))}
  </div>

  {previewItem ? (
    <aside className="workflow-canvas-quick-add-preview" aria-live="polite">
      <div className="workflow-canvas-quick-add-preview-label">{previewItem.label}</div>
      <div className="workflow-canvas-quick-add-preview-meta">
        {formatWorkflowNodeMeta(previewItem.capabilityGroup, previewItem.type, previewItem.label)}
      </div>
      <p className="workflow-canvas-quick-add-preview-copy">
        {previewItem.description || "当前节点还没有补充描述。"}
      </p>
    </aside>
  ) : null}
</div>
```

- [ ] **Step 3: Update the menu styles for two-column layout, compact rows, and responsive fallback**

```css
.workflow-canvas-quick-add-menu {
  width: min(560px, calc(100vw - 48px));
  max-height: min(520px, calc(100vh - 72px));
}

.workflow-canvas-quick-add-body {
  display: grid;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  flex: 1 1 auto;
}

.workflow-canvas-quick-add-menu-list {
  min-height: 0;
  overflow-y: auto;
}

.workflow-canvas-quick-add-option {
  gap: 0;
  padding: 9px 12px;
  border-radius: 12px;
}

.workflow-canvas-quick-add-option.previewing {
  border-color: rgba(31, 94, 213, 0.22);
  background: #f5f9ff;
}

.workflow-canvas-quick-add-preview {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  padding: 14px;
  border: 1px solid #d8e0ec;
  border-radius: 16px;
  background: #f8fbff;
}

@media (max-width: 720px) {
  .workflow-canvas-quick-add-body {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Re-run the targeted test and the existing quick-add guard test**

Run:

```bash
cd /home/taichu/git/7flows/web && corepack pnpm exec vitest run components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.client.test.tsx components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.test.ts --cache=false
```

Expected: PASS with both tests green.

- [ ] **Step 5: Run lint to verify the component and CSS changes fit the frontend baseline**

Run:

```bash
cd /home/taichu/git/7flows/web && pnpm lint
```

Expected: PASS without new lint errors.

- [ ] **Step 6: Commit the implementation once tests and lint pass**

```bash
cd /home/taichu/git/7flows
git add web/components/workflow-editor-workbench/workflow-canvas-quick-add.tsx web/components/workflow-editor-workbench/__tests__/workflow-canvas-quick-add.client.test.tsx web/app/globals.css
git commit -m "feat(workflow): compact quick add hover preview"
```

## Self-Review

- Spec coverage:
  - 双栏布局、侧边预览、列表压缩、搜索回退、focus 可访问性、空态保留和响应式回退都分别映射到 Task 1 和 Task 2。
- Placeholder scan:
  - 计划中没有 `TODO` / `TBD` / “类似 Task N” 之类占位描述；每个代码步骤都给了具体代码或命令。
- Type consistency:
  - 统一使用 `previewType` / `previewItem` 命名，测试和实现都围绕 `WorkflowCanvasQuickAddTrigger` 当前对外接口，不引入额外 props。
