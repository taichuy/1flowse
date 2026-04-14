---
memory_type: tool
topic: Testing Library 查询 Ant Design Select 的 role option 会命中 rc-select 隐藏可访问性镜像
summary: 在 `antd` 的 `Select` 使用 `rc-select` 虚拟列表时，`findByRole('option')` 命中的可能是隐藏的 a11y 镜像节点，直接点击不会触发选择；应改为查询可视层 `.ant-select-item-option-content` 或其父 option 行再触发事件。
keywords:
  - testing-library
  - antd
  - rc-select
  - option
  - virtual-list
  - hidden-a11y
match_when:
  - 在测试里打开 `antd` `Select` 后能查到 `role="option"`，但点击后不触发 `onChange`
  - `rc-select` 下拉启用了虚拟列表或默认虚拟渲染
  - 需要给自定义 `optionRender` 的下拉项写交互测试
created_at: 2026-04-14 22
updated_at: 2026-04-14 22
last_verified_at: 2026-04-14 22
decision_policy: reference_on_failure
scope:
  - testing-library
  - antd
  - rc-select
  - web/app/src/features/settings/_tests/api-docs-panel.test.tsx
---

# Testing Library 查询 Ant Design Select 的 role option 会命中 rc-select 隐藏可访问性镜像

## 时间

`2026-04-14 22`

## 失败现象

测试里已经成功打开 `antd` 的 `Select` 下拉，也能通过 `findByRole('option', { name: /runtime/i })` 查到选项，但 `fireEvent.click(...)` 后：

- `onChange` 没有触发；
- URL、状态和页面内容都不变化；
- 看起来像“点中了 option 但组件没响应”。

## 为什么做这个操作

需要为 `/settings/docs` 的分类选择器补齐交互测试，验证切换分类后 `?category=` 深链接与 Scalar 详情区都能更新。

## 触发条件

- 使用 `antd` `Select`
- 组件底层为 `rc-select`，且启用默认虚拟列表
- 在 Testing Library 中通过 `role="option"` 查询选项并直接点击

## 根因

`rc-select` 会额外渲染一套隐藏的可访问性镜像：

- `role="listbox"` / `role="option"` 节点存在于隐藏层，只用于 a11y；
- 真正可点击的可视层节点是 `.ant-select-item-option` 及其内部 `.ant-select-item-option-content`；
- Testing Library 的 `findByRole('option')` 命中的是隐藏镜像时，点击不会走到实际的选项点击处理逻辑。

## 解法

- 不要把 `role="option"` 查询结果直接当成可点击目标；
- 改为查询可视层 `.ant-select-item-option-content`，再对该节点触发 `click`，让事件冒泡到真实选项行；
- 如果 `optionRender` 让文本变成复合内容，使用函数 matcher + `element.matches('.ant-select-item-option-content')` + `textContent.includes(...)`，不要依赖精确纯文本匹配。

## 验证方式

- `pnpm --dir web/app exec vitest run src/features/settings/_tests/api-docs-panel.test.tsx`
- 目标用例应通过，且分类切换后 `window.location.search` 变为新分类；
- 同时运行 `pnpm --dir web lint`，确认没有因为直接 DOM 访问触发 `testing-library/no-node-access`。

## 复现记录

- `2026-04-14 22`：在 `/settings/docs` 分类选择器测试里先后尝试点击 `findByRole('option')` 和直接 `document.querySelectorAll('.ant-select-item-option')`。前者命中隐藏 a11y 镜像，点击无效；后者虽然能工作，但触发 `testing-library/no-node-access`。最终改为用 Testing Library 的函数 matcher 命中 `.ant-select-item-option-content`，交互与 lint 同时通过。
