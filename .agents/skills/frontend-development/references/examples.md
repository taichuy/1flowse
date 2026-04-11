# Frontend Pressure Scenarios

## Scenario 1: One-Off Component Extraction

症状：

- 某个页面里出现一段 30 行 JSX
- 只有这一个地方用到
- 你想先抽成公共组件

结论：

- 不要因为“看起来更模块化”就先抽
- 先看变化原因是否单一、是否会出现第二个真实使用点

## Scenario 2: Nested Widget State Sprawl

症状：

- 页面根组件维护十几个 `useState`
- 子组件靠 props 层层下发控制弹窗、表单、筛选、加载

结论：

- 先收敛状态归属
- 页面保留页面级状态，局部交互状态下沉，共享状态只保留跨区域协调

## Scenario 3: It Is Not A Styling Problem

症状：

- 用户说“这个页面不对劲”
- 你第一反应是改 spacing、颜色、按钮

结论：

- 先检查是不是入口、层级、交互一致性问题
- 如果是结构问题，转交 `frontend-logic-design`
