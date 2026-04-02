# Minimalist Monochrome × Ant Design 落地参考

## 目标

把用户要求的 `Minimalist Monochrome` 风格压进当前 `web/` 的真实栈：`Ant Design + globals.css + 少量 editor 自定义样式`。

## 当前仓库与目标风格的主要冲突

- 当前 `web/app/globals.css` 仍大量使用圆角、渐变、阴影和偏温和的卡片语义
- 当前全局字体仍偏 `Inter` / 系统 sans，而不是 serif 主导
- 当前部分页面仍以卡片堆叠和长段 copy 为主，缺少结构化子交互

因此任何“黑白极简改造”都不应只改单个组件，而要先回答：

1. token 放哪
2. 字体怎么统一
3. Ant Design 默认圆角 / 阴影怎么系统性收口
4. 页面说明文如何迁移到 drawer / modal / collapse / popover

## Token 映射建议

### CSS 变量

建议把共享 token 收到 CSS 变量，再由 Ant Design 主题与自定义样式共同消费：

- `--background: #ffffff`
- `--foreground: #000000`
- `--muted: #f5f5f5`
- `--muted-foreground: #525252`
- `--border: #000000`
- `--border-light: #e5e5e5`
- `--card: #ffffff`
- `--card-foreground: #000000`

### Ant Design 主题

建议至少统一这些 token：

- `colorBgBase = #ffffff`
- `colorTextBase = #000000`
- `colorBorder = #000000`
- `colorPrimary = #000000`
- `colorLink = #000000`
- `borderRadius = 0`
- `boxShadow = none`
- `boxShadowSecondary = none`

组件覆盖重点：

- `Button`：主按钮黑底白字；默认按钮黑边白底；圆角清零
- `Input` / `Select` / `InputNumber`：边框黑色；focus 通过边框加粗体现
- `Card`：默认不用阴影；边框黑色；如果只是信息分组，优先考虑 borderless section
- `Drawer` / `Modal` / `Dropdown`：边框与分隔线替代阴影层次
- `Tabs`：线条主导，避免彩色 ink bar
- `Tag` / `Badge`：只用黑白灰，不引入状态彩虹

## 字体建议

- Display / headline：`Playfair Display`
- Body：`Source Serif 4`
- Meta / label / code：`JetBrains Mono`

落地时优先走统一字体入口，不要在单个组件里各自写 font family。

## 结构化交互建议

### 该收进 Drawer / Modal 的内容

- 节点配置
- 节点创建向导
- 发布配置明细
- 高级 JSON
- 解释性治理说明
- 二级详情 drill-in

### 该留在主界面的内容

- 当前任务最关键的状态
- 下一步动作
- 当前 selection 的一级属性
- 画布、列表、筛选、主 CTA

## 绝对不要做的事

- 黑白化以后仍保留大面积柔和阴影和圆角
- 用灰阶去模拟“多彩状态系统”
- 把大段说明文直接放在每个 section 头部
- 把黑白极简做成“啥都没有”的空白页面，而不是有节奏的 editorial 层级

## 细节提示

- 反相区块可用于 stats、重点 CTA、选中态面板
- 使用粗横线和强边界代替阴影分层
- 大标题允许成为图形元素，但正文仍需保证可读性
- hover 与 focus 优先瞬时反相、边框加粗、下划线出现，不做慢动画
