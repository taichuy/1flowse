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

export interface ConsoleEntry {
  title: string;
  href: string;
  description: string;
  note: string;
  status: DemoStatus;
}

export interface GovernanceItem {
  title: string;
  detail: string;
}

export interface SnapshotItem {
  key: string;
  label: string;
  value: string;
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
  mountMode: string;
  authScope: string;
  lastUpdated: string;
  pendingActions: string[];
}

export interface SettingField {
  key: string;
  label: string;
  value: string;
}

export const workbenchMetrics: MetricCard[] = [
  {
    label: '控制面健康',
    value: '99.94%',
    status: 'healthy',
    note: '过去 24 小时认证、接口与运行时状态稳定。'
  },
  {
    label: '待处理事项',
    value: '03',
    status: 'waiting',
    note: '需要回写 webhook、权限复核与交付确认。'
  },
  {
    label: '已接入子系统',
    value: '12',
    status: 'running',
    note: '统一复用会话上下文和宿主挂载能力。'
  },
  {
    label: '本周交付窗口',
    value: '02',
    status: 'draft',
    note: '还有两项治理策略等待最终拍板。'
  }
];

export const consoleEntries: ConsoleEntry[] = [
  {
    title: '查看子系统接入',
    href: '/subsystems',
    description: '检查挂载路由、版本与访问边界，继续核对每个业务入口的宿主契约。',
    note: '12 个接入入口已纳入统一路由前缀。',
    status: 'running'
  },
  {
    title: '查看工具台',
    href: '/tools',
    description: '集中处理接口审阅、运行告警与交付检查，不再散落在多张临时卡片里。',
    note: '当前有 3 项待处理事项需要排队收口。',
    status: 'failed'
  },
  {
    title: '打开控制台设置',
    href: '/settings',
    description: '管理账户资料、安全策略、访问控制和接口文档入口。',
    note: '设置区已经固定为控制台独立管理域。',
    status: 'draft'
  }
];

export const governanceNotes: GovernanceItem[] = [
  {
    title: '权限矩阵待复核',
    detail: 'own / all 两类授权语义仍需继续校验，避免发布前出现范围冲突。'
  },
  {
    title: '接口入口已收口',
    detail: '接口文档、调用日志和监控报表都已归进工具台，后续不再拆出并列主入口。'
  },
  {
    title: '移动端壳层进入稳定期',
    detail: '这一轮重点转向压缩顶部壳层与入口文案，而不是继续调整颜色方向。'
  }
];

export const workspaceSnapshot: SnapshotItem[] = [
  {
    key: 'team',
    label: '当前团队',
    value: 'Growth Lab'
  },
  {
    key: 'role',
    label: '当前角色',
    value: '平台负责人'
  },
  {
    key: 'release',
    label: '最近发布',
    value: '2026-04-13 18:40'
  }
];

export const demoRuns: RunItem[] = [
  {
    id: 'run_1021',
    flow: '发布检查 / revision-24',
    owner: 'Platform Ops',
    startedAt: '09:40',
    status: 'waiting',
    summary: '等待回写',
    detail: '最近一次发布任务已完成，等待 webhook 回写。',
    events: [
      '09:40 生成 revision-24 发布快照',
      '09:43 推送运行时配置到宿主扩展',
      '09:46 等待第三方 webhook 回写确认'
    ]
  },
  {
    id: 'run_1018',
    flow: '子系统同步 / embed-registry',
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
    startedAt: '昨天 17:20',
    status: 'failed',
    summary: '权限冲突',
    detail: '角色矩阵中存在一条 own/all 语义冲突，需要人工回到访问控制面板处理。',
    events: [
      '昨天 17:20 发现 API 文档与权限矩阵不一致',
      '昨天 17:35 自动修复失败并要求人工复核',
      '昨天 17:42 已写入治理待办'
    ]
  }
];

export const studioNodes: StudioNode[] = [
  {
    id: 'requirement-intake',
    name: '需求汇总',
    kind: '输入',
    owner: '产品运营',
    status: 'running',
    description: '把需求、文档和边界约束整理成稳定上下文，避免直接把零散信息带进编排。',
    output: '输出结构化上下文，供后续权限校验和发布检查复用。'
  },
  {
    id: 'policy-check',
    name: '权限校验',
    kind: '校验',
    owner: '安全团队',
    status: 'waiting',
    description: '校验权限、会话、暴露级别和当前宿主约束是否匹配。',
    output: '输出 allow / review-needed 结果，并标记影响范围。'
  },
  {
    id: 'release-gateway',
    name: '发布网关',
    kind: '执行',
    owner: '平台运行时',
    status: 'healthy',
    description: '负责把已确认流程发布到宿主运行时，并同步更新入口版本。',
    output: '生成 runtime revision，通知工具台和日志页回填状态。'
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
    summary: '营销工作台，当前通过 host-extension 方式挂到控制台。',
    mountMode: 'host-extension',
    authScope: '继承当前控制台会话',
    lastUpdated: '2026-04-13 18:10',
    pendingActions: ['确认新版资源包的缓存策略', '补齐默认团队欢迎页']
  },
  {
    id: 'ops-board',
    name: 'Ops Board',
    status: 'running',
    routePrefix: '/embedded/ops-board',
    owner: 'Operations',
    version: '0.3.8',
    summary: '运营协同板，依赖统一会话和权限上下文。',
    mountMode: 'embedded-runtime',
    authScope: '控制台会话 + 运行时权限映射',
    lastUpdated: '2026-04-13 15:35',
    pendingActions: ['等待最新 manifest 校验完成']
  },
  {
    id: 'docs-hub',
    name: 'Docs Hub',
    status: 'draft',
    routePrefix: '/embedded/docs-hub',
    owner: 'Developer Experience',
    version: '0.2.0',
    summary: '正在收口 API 文档与最佳实践入口，还未进入正式发布。',
    mountMode: 'static bundle',
    authScope: '只读文档访问',
    lastUpdated: '2026-04-12 21:20',
    pendingActions: ['补齐 API 文档跳转入口', '确认版本切换策略']
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

export const monitoringSignals: MetricCard[] = [
  {
    label: '运行时告警',
    value: '02',
    status: 'failed',
    note: '一条权限冲突，一条 webhook 超时。'
  },
  {
    label: '待审核变更',
    value: '05',
    status: 'waiting',
    note: '需要平台 owner 或 security 二次确认。'
  },
  {
    label: '稳定窗口',
    value: '18h',
    status: 'healthy',
    note: '最近一段时间无 API 级中断。'
  }
];

export const toolFollowUps = [
  '统一接口文档嵌入方式，避免再维护第二套说明页。',
  '把运行告警与发布检查统一收进工具台待处理事项。',
  '控制日志细节的呈现层级，避免首页继续承担深度运维信息。'
];

export const profileFields: SettingField[] = [
  {
    key: 'display-name',
    label: '显示名',
    value: 'Mina Chen'
  },
  {
    key: 'email',
    label: '邮箱',
    value: 'mina@growthlab.dev'
  },
  {
    key: 'role',
    label: '默认角色',
    value: '平台负责人'
  },
  {
    key: 'active',
    label: '最近活跃',
    value: '2026-04-14 00:48'
  }
];

export const securityFields: SettingField[] = [
  {
    key: 'password-policy',
    label: '密码策略',
    value: '90 天轮换一次'
  },
  {
    key: 'session-duration',
    label: '会话时长',
    value: '12 小时自动失效'
  },
  {
    key: 'mfa',
    label: '双重验证',
    value: '高风险操作必须二次确认'
  }
];

export const securityNotes = [
  '最近 30 天未出现异常设备登录。',
  '当前设备已绑定最近一次密码修改记录。',
  '删除会话和重置密码会统一写入审计日志。'
];

export const accessMatrix = [
  {
    key: 'owner',
    role: '平台负责人',
    scope: 'all',
    permissions: 'members, roles, api-docs, publish'
  },
  {
    key: 'ops',
    role: '运营负责人',
    scope: 'team',
    permissions: 'runs, monitoring, release-review'
  },
  {
    key: 'builder',
    role: '流程构建者',
    scope: 'own',
    permissions: 'studio, draft-release'
  }
];

export const apiDocHighlights = [
  '控制台内嵌后端文档入口，减少上下文切换。',
  '文档与角色权限矩阵一起校验，避免接口与授权说明脱节。',
  '后续切换到真实接口后，只替换数据源，不改变页面结构。'
];
