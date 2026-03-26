const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_ISSUE_MARKER,
  buildIssueBody,
  hasExternalBlocker,
  parseArgs,
} = require('./sync-github-security-drift-issue');

function createReport(overrides = {}) {
  return {
    generatedAt: '2026-03-26T07:34:37.000Z',
    repository: { owner: 'taichuy', repo: '7flows' },
    defaultBranch: 'taichuy_dev',
    conclusion: {
      kind: 'alerts_unavailable',
      summary: '当前 workflow token 无法读取 Dependabot alerts；请补充 DEPENDABOT_ALERTS_TOKEN。',
    },
    dependabotAlerts: {
      unavailable: true,
      openAlertCount: 0,
      actionableAlertCount: 0,
      alerts: [],
    },
    repositorySecurityAndAnalysis: {
      checkedAt: '2026-03-26T07:34:31.191Z',
      dependencyGraphStatus: null,
      automaticDependencySubmissionStatus: null,
      dependabotSecurityUpdatesStatus: null,
      missingFields: ['dependency_graph', 'automatic_dependency_submission'],
      manualVerificationRequired: true,
      manualVerificationReason: 'missing_dependency_graph_fields',
    },
    dependencySubmissionEvidence: {
      runId: 23582800642,
      htmlUrl: 'https://github.com/taichuy/7flows/actions/runs/23582800642',
      repositoryBlocker:
        'GitHub `Dependency graph` 未开启；workflow 已保留证据并降级为 warning，而不是把当前代码事实误判成实现失败。',
      repositoryBlockerEvidence: {
        kind: 'dependency_graph_disabled',
        status: 404,
        rootLabels: ['api', 'services/compat-dify', 'web'],
        message: 'The Dependency graph is disabled for this repository. Please enable it before submitting snapshots.',
      },
      dependencyGraphVisibility: {
        checkedAt: '2026-03-26T07:34:31.011Z',
        manifestCount: 0,
        visibleRoots: [],
        missingRoots: ['api', 'services/compat-dify', 'web'],
      },
    },
    recommendedActions: [
      {
        priority: 1,
        audience: 'repository_admin',
        code: 'enable_dependency_graph',
        summary: '在 `Settings -> Security & analysis` 启用 `Dependency graph`。',
        rationale: 'submission API 已返回 404 blocker。',
        roots: ['api', 'services/compat-dify', 'web'],
        href: 'https://github.com/taichuy/7flows/settings/security_analysis',
        hrefLabel: '打开仓库安全设置',
        documentationHref:
          'https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/enabling-the-dependency-graph',
        documentationHrefLabel: '查看官方 Dependency graph 指引',
        manualOnly: true,
        manualOnlyReason: 'github_settings_ui',
      },
      {
        priority: 2,
        audience: 'repository_admin',
        code: 'configure_dependabot_alerts_token',
        summary: '配置 `DEPENDABOT_ALERTS_TOKEN`。',
        rationale: '恢复 workflow 内的 alert 对照。',
        roots: [],
        href: 'https://github.com/taichuy/7flows/settings/secrets/actions',
        hrefLabel: '打开 Actions secrets',
      },
    ],
    ...overrides,
  };
}

test('hasExternalBlocker returns true for alerts_unavailable conclusion', () => {
  assert.equal(hasExternalBlocker(createReport()), true);
});

test('hasExternalBlocker returns true when recommended actions still require external blocker work', () => {
  const report = createReport({
    conclusion: {
      kind: 'actionable_alerts',
      summary: '仍有真实依赖问题。',
    },
  });

  assert.equal(hasExternalBlocker(report), true);
});

test('hasExternalBlocker returns false when report is already resolved and no external action remains', () => {
  const report = createReport({
    conclusion: {
      kind: 'actionable_alerts',
      summary: '仍有真实依赖问题。',
    },
    recommendedActions: [
      {
        priority: 1,
        audience: 'dependency_owner',
        code: 'upgrade_dependency',
        summary: '升级依赖。',
        roots: ['web'],
      },
    ],
  });

  assert.equal(hasExternalBlocker(report), false);
});

test('buildIssueBody renders blocker evidence and recommended actions', () => {
  const escapedMarker = DEFAULT_ISSUE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = buildIssueBody(createReport(), { issueMarker: DEFAULT_ISSUE_MARKER });

  assert.match(body, /GitHub Security Drift 外部阻塞跟踪/);
  assert.match(body, /dependency_graph_disabled/);
  assert.match(body, /打开仓库安全设置/);
  assert.match(body, /manual-only step \(github_settings_ui\)/);
  assert.match(body, /`api`、`services\/compat-dify`、`web`/);
  assert.match(body, /manual verification reason: `missing_dependency_graph_fields`/);
  assert.match(body, /gh api -X PATCH repos\/\{owner\}\/\{repo\}/);
  assert.match(body, /Enabling the dependency graph/);
  assert.match(body, /Configuring automatic dependency submission/);
  assert.match(body, /DEPENDABOT_ALERTS_TOKEN/);
  assert.match(body, new RegExp(escapedMarker));
});

test('buildIssueBody treats missing dependency graph fields as manual verification even without explicit flag', () => {
  const body = buildIssueBody(
    createReport({
      repositorySecurityAndAnalysis: {
        checkedAt: '2026-03-26T08:15:00.000Z',
        dependencyGraphStatus: null,
        automaticDependencySubmissionStatus: null,
        dependabotSecurityUpdatesStatus: 'disabled',
        missingFields: ['dependency_graph'],
      },
    }),
  );

  assert.match(body, /fields absent from repo API payload: `dependency_graph`/);
  assert.match(body, /不应把缺失误判成“已开启”/);
  assert.match(body, /Settings -> Security & analysis/);
});

test('buildIssueBody renders resolved snapshot when blocker is gone', () => {
  const body = buildIssueBody(
    createReport({
      conclusion: {
        kind: 'no_open_alerts',
        summary: '当前没有 open alert。',
      },
      recommendedActions: [],
    }),
    { issueMarker: DEFAULT_ISSUE_MARKER, resolved: true },
  );

  assert.match(body, /已由自动化关闭/);
  assert.match(body, /外部阻塞状态：已解除或已转入本地依赖修复/);
});

test('parseArgs supports dry-run and custom title', () => {
  const options = parseArgs([
    '--report',
    'dependabot-drift.json',
    '--issue-title',
    'Custom Title',
    '--dry-run',
  ]);

  assert.equal(options.reportPath, 'dependabot-drift.json');
  assert.equal(options.issueTitle, 'Custom Title');
  assert.equal(options.dryRun, true);
});
