export type DemoStatus =
  | 'running'
  | 'waiting'
  | 'failed'
  | 'healthy'
  | 'draft'
  | 'selected';

export interface MetricCard {
  label: string;
  value: string;
  status: DemoStatus;
  note: string;
}

export interface RunItem {
  id: string;
  flow: string;
  owner: string;
  startedAt: string;
  status: DemoStatus;
  summary: string;
  detail: string;
  events: string[];
}

export interface StudioNode {
  id: string;
  name: string;
  kind: string;
  owner: string;
  status: DemoStatus;
  description: string;
  output: string;
}

export interface SubsystemItem {
  id: string;
  name: string;
  status: DemoStatus;
  routePrefix: string;
  owner: string;
  version: string;
  summary: string;
}

export const workbenchMetrics: MetricCard[] = [
  {
    label: '控制面健康',
    value: '99.94%',
    status: 'healthy',
    note: '过去 24 小时 Auth / API / Runtime 汇总'
  },
  {
    label: '待处理发布',
    value: '03',
    status: 'waiting',
    note: '需要回写 webhook 或人工确认'
  },
  {
    label: '活动子系统',
    value: '12',
    status: 'running',
    note: '已接入的嵌入式应用和宿主挂载'
  },
  {
    label: '治理缺口',
    value: '02',
    status: 'draft',
    note: '移动端 Studio 与权限说明仍需继续收口'
  }
];

export const workbenchTracks = [
  {
    title: '控制台壳层',
    detail: '顶部导航已回到稳定的 L2 页面入口，避免把 Studio 和详情页直接挂到一级导航。'
  },
  {
    title: '子系统接入',
    detail: '保留 embedded-apps 作为子系统边界，用 mock 数据先验证版本、挂载、宿主约束的展示方式。'
  },
  {
    title: '设置收口',
    detail: '个人资料、团队、访问控制和 API 文档统一进入设置页，避免继续散落在 bootstrap 卡片里。'
  }
];

export const critiqueNotes = [
  '旧的 mock-ui 更像组件预览板，缺少真实的工作台、设置和工具入口关系。',
  '现有 web 主题已经回到浅色翡翠语义，但 docs 中仍残留深色母稿，demo 必须优先反映已落地的控制台现状。',
  'Studio 仍需要在移动端继续压缩信息层级，这一轮先通过列表化 inspector 结构收口。'
];

export const demoRuns: RunItem[] = [
  {
    id: 'run_1021',
    flow: 'Release Gate / agent-flow-v3',
    owner: 'Platform Ops',
    startedAt: '09:40',
    status: 'waiting',
    summary: '等待回写',
    detail: '最近一次发布任务已完成，等待 webhook 回写。',
    events: [
      '09:40 生成发布快照并冻结参数',
      '09:43 推送运行时配置到 host-extension',
      '09:46 等待第三方 webhook 回写确认'
    ]
  },
  {
    id: 'run_1018',
    flow: 'Sub-system Sync / embed-registry',
    owner: 'Growth Systems',
    startedAt: '08:05',
    status: 'running',
    summary: '正在同步',
    detail: '子系统挂载注册表正在增量同步，等待最后一轮 manifest 校验。',
    events: [
      '08:05 读取最新 manifest',
      '08:11 更新 routePrefix 和 mount context',
      '08:18 校验权限边界和 host capability'
    ]
  },
  {
    id: 'run_1014',
    flow: 'Policy Review / role-grid',
    owner: 'Security',
    startedAt: 'Yesterday',
    status: 'failed',
    summary: '权限冲突',
    detail: '角色矩阵中存在一条 own/all 语义冲突，需要人工回到访问控制面板处理。',
    events: [
      '昨日 17:20 发现 API 文档与权限矩阵不一致',
      '昨日 17:35 自动修复失败并要求人工复核',
      '昨日 17:42 已写入治理待办'
    ]
  }
];

export const studioNodes: StudioNode[] = [
  {
    id: 'knowledge-intake',
    name: 'Knowledge Intake',
    kind: 'Input',
    owner: 'Product Ops',
    status: 'running',
    description: '收集需求、文档和边界约束，把不稳定信息整理成可执行上下文。',
    output: '输出结构化 brief，供后续 studio 与工具页复用。'
  },
  {
    id: 'policy-check',
    name: 'Policy Check',
    kind: 'Guard',
    owner: 'Security',
    status: 'waiting',
    description: '校验权限、会话、暴露级别和当前宿主约束是否匹配。',
    output: '输出 allow / review-needed 结果，并标记 blast radius。'
  },
  {
    id: 'release-gateway',
    name: '发布网关',
    kind: 'Execute',
    owner: 'Platform Runtime',
    status: 'healthy',
    description: '负责把已确认流程发布到宿主运行时，并同步更新入口版本。',
    output: '生成 runtime revision，通知工具页与日志页回填状态。'
  }
];

export const subsystems: SubsystemItem[] = [
  {
    id: 'growth-portal',
    name: 'Growth Portal',
    status: 'healthy',
    routePrefix: '/embedded/growth-portal',
    owner: 'Growth Systems',
    version: '0.4.2',
    summary: '营销工作台，当前通过 host-extension 方式挂到控制台。'
  },
  {
    id: 'ops-board',
    name: 'Ops Board',
    status: 'running',
    routePrefix: '/embedded/ops-board',
    owner: 'Operations',
    version: '0.3.8',
    summary: '运营协同板，依赖统一会话和权限上下文。'
  },
  {
    id: 'docs-hub',
    name: 'Docs Hub',
    status: 'draft',
    routePrefix: '/embedded/docs-hub',
    owner: 'Developer Experience',
    version: '0.2.0',
    summary: '正在收口 API 文档与最佳实践入口，还未进入正式发布。'
  }
];

export const apiSurface = [
  {
    key: 'me',
    method: 'GET',
    path: '/api/console/me',
    exposure: 'console',
    note: '读取当前登录用户、角色和团队上下文。'
  },
  {
    key: 'team',
    method: 'PATCH',
    path: '/api/console/team',
    exposure: 'console',
    note: '更新团队显示名、通知策略和工作区默认配置。'
  },
  {
    key: 'signin',
    method: 'POST',
    path: '/api/public/auth/providers/password-local/sign-in',
    exposure: 'public',
    note: '本地账号登录，建立当前设备会话。'
  }
];

export const monitoringSignals = [
  {
    label: '运行时告警',
    value: '2',
    status: 'failed' as const,
    note: '一条权限冲突，一条 webhook 超时'
  },
  {
    label: '等待审核',
    value: '5',
    status: 'waiting' as const,
    note: '需要平台 owner 或 security 二次确认'
  },
  {
    label: '稳定窗口',
    value: '18h',
    status: 'healthy' as const,
    note: '最近一段无 API 级中断'
  }
];

export const accessMatrix = [
  {
    key: 'owner',
    role: 'Platform Owner',
    scope: 'all',
    permissions: 'members, roles, api-docs, publish'
  },
  {
    key: 'ops',
    role: 'Ops Lead',
    scope: 'team',
    permissions: 'runs, monitoring, release-review'
  },
  {
    key: 'builder',
    role: 'Flow Builder',
    scope: 'own',
    permissions: 'studio, draft-release'
  }
];
