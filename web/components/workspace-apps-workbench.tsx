import Link from "next/link";

import { formatTimestamp } from "@/lib/runtime-presenters";
import { getWorkspaceBadgeLabel } from "@/lib/workspace-ui";

type WorkspaceModeTab = {
  key: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
};

type WorkspaceScopePill = {
  key: string;
  label: string;
  value: string;
  href: string;
};

type WorkspaceStatusFilter = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

type WorkspaceSignal = {
  label: string;
  value: string;
};

type WorkspaceQuickCreateEntry = {
  title: string;
  detail: string;
  href: string;
  badge: string;
};

type WorkspaceStarterHighlight = {
  id: string;
  name: string;
  description: string;
  href: string;
  track: string;
  priority: string;
  modeShortLabel: string;
};

type WorkspaceAppCard = {
  id: string;
  name: string;
  href: string;
  status: string;
  healthLabel: string;
  recommendedNextStep: string;
  updatedAt: string;
  nodeCount: number;
  publishCount: number;
  missingToolCount: number;
  followUpCount: number;
  mode: {
    label: string;
    shortLabel: string;
  };
  track: {
    id: string;
    priority: string;
    focus: string;
    summary: string;
  };
};

type WorkspaceAppsWorkbenchProps = {
  workspaceName: string;
  canManageMembers: boolean;
  currentRoleLabel: string;
  currentUserDisplayName: string;
  requestedKeyword: string;
  activeModeLabel: string | null;
  activeModeDescription: string;
  visibleAppSummary: string;
  modeTabs: WorkspaceModeTab[];
  scopePills: WorkspaceScopePill[];
  statusFilters: WorkspaceStatusFilter[];
  workspaceSignals: WorkspaceSignal[];
  quickCreateEntries: WorkspaceQuickCreateEntry[];
  starterHighlights: WorkspaceStarterHighlight[];
  starterCount: number;
  filteredApps: WorkspaceAppCard[];
  searchState: {
    filter: string | null;
    mode: string | null;
    track: string | null;
    clearHref: string | null;
  };
};

function WorkspaceSummaryBar({
  workspaceSignals,
  compact = false
}: {
  workspaceSignals: WorkspaceSignal[];
  compact?: boolean;
}) {
  return (
    <div
      className={`workspace-summary-bar workspace-summary-bar-studio${compact ? " workspace-summary-bar-inline" : ""}`}
      aria-label="Workspace overview"
    >
      {workspaceSignals.map((signal) => (
        <article
          className={`workspace-summary-stat workspace-summary-stat-studio${compact ? " workspace-summary-stat-inline" : ""}`}
          key={signal.label}
        >
          <span>{signal.label}</span>
          <strong>{signal.value}</strong>
        </article>
      ))}
    </div>
  );
}

function WorkspaceStageGuideCard({
  activeModeDescription,
  activeModeLabel,
  canManageMembers,
  requestedKeyword
}: {
  activeModeDescription: string;
  activeModeLabel: string | null;
  canManageMembers: boolean;
  requestedKeyword: string;
}) {
  const currentScopeSummary = requestedKeyword
    ? `当前按“${requestedKeyword}”聚焦应用；命中后直接继续进入 xyflow。`
    : activeModeLabel
      ? `当前筛选聚焦 ${activeModeLabel}；${activeModeDescription}`
      : "当前展示全部应用；先完成创建或筛选，再继续进入编排。";

  return (
    <aside className="workspace-catalog-card workspace-stage-guide-card" aria-label="Workspace stage guide">
      <div className="workspace-stage-guide-copy">
        <p className="workspace-app-card-caption">主链路</p>
        <h3>先挑入口，再继续进入 xyflow</h3>
        <p className="workspace-muted workspace-card-copy">
          参考 Dify 的工作台心智，把“创建入口”“成员与权限”“最近应用”拆成不同层级；真正的节点编排、
          调试和发布仍然回到 7Flows Studio。
        </p>
      </div>

      <div className="workspace-stage-guide-focus">
        <span className="workspace-app-footnote">当前范围：{activeModeLabel ?? "全部应用"}</span>
        <span className="workspace-app-footnote">{currentScopeSummary}</span>
      </div>

      <div className="workspace-stage-guide-list">
        <article className="workspace-stage-guide-step">
          <span>01</span>
          <strong>从空白或模板开始</strong>
          <p>先在工作台里决定是新建空白应用，还是从 starter 模板继续。</p>
        </article>
        <article className="workspace-stage-guide-step">
          <span>02</span>
          <strong>{canManageMembers ? "管理员在工作台管理成员" : "成员从工作台查看运行诊断"}</strong>
          <p>
            {canManageMembers
              ? "成员与权限单独走团队设置，不再混进应用卡片里造成噪音。"
              : "没有成员管理权限时，优先从运行诊断继续排查主链问题。"}
          </p>
        </article>
        <article className="workspace-stage-guide-step">
          <span>03</span>
          <strong>进入 Studio 持续编排</strong>
          <p>应用卡片只负责回到 xyflow 和运行诊断，不再承担长篇治理说明。</p>
        </article>
      </div>

      <div className="workspace-stage-guide-actions">
        {canManageMembers ? (
          <Link className="workspace-primary-button compact" href="/admin/members">
            管理成员与权限
          </Link>
        ) : null}
        <Link className="workspace-ghost-button compact" href="/runs">
          查看运行诊断
        </Link>
      </div>
    </aside>
  );
}

function WorkspaceScopePills({ scopePills }: { scopePills: WorkspaceScopePill[] }) {
  if (scopePills.length === 0) {
    return null;
  }

  return (
    <div className="workspace-scope-pills" aria-label="Workspace scopes">
      {scopePills.map((scopePill) => (
        <Link className="workspace-scope-pill" href={scopePill.href} key={scopePill.key}>
          <span>{scopePill.label}</span>
          <strong>{scopePill.value}</strong>
        </Link>
      ))}
    </div>
  );
}

function WorkspaceCreateBoardCard({
  activeModeDescription,
  activeModeLabel,
  quickCreateEntries,
  starterHighlights,
  starterCount
}: {
  activeModeDescription: string;
  activeModeLabel: string | null;
  quickCreateEntries: WorkspaceQuickCreateEntry[];
  starterHighlights: WorkspaceStarterHighlight[];
  starterCount: number;
}) {
  const visibleStarterHighlights = starterHighlights.slice(0, 2);

  return (
    <article
      className="workspace-app-card workspace-create-board-card workspace-create-board-card-studio workspace-catalog-card"
      key="workspace-create-card"
    >
      <div className="workspace-create-board-head workspace-create-board-head-studio">
        <div className="workspace-create-board-copy">
          <p className="workspace-app-card-caption">创建应用</p>
          <h3>{activeModeLabel ? `创建 ${activeModeLabel} 应用` : "从空白、模板或成员入口开始"}</h3>
          <p className="workspace-muted workspace-card-copy">
            {activeModeLabel
              ? `${activeModeDescription} 创建完成后直接回到 xyflow 继续编排。`
              : "工作台聚焦创建、筛选和继续进入编排，不在这里堆运行与治理长描述。"}
          </p>
        </div>

        <Link className="workspace-ghost-button compact workspace-create-board-library-link" href="/workspace-starters">
          查看 Starter 模板
        </Link>
      </div>

      <div className="workspace-create-board-actions workspace-create-board-actions-studio">
        {quickCreateEntries.map((entry) => (
          <Link className="workspace-create-board-entry workspace-create-board-entry-studio" href={entry.href} key={entry.title}>
            <strong className="workspace-create-board-entry-badge">{entry.badge}</strong>
            <div className="workspace-create-link-copy workspace-create-board-entry-copy">
              <span>{entry.title}</span>
              <small>{entry.detail}</small>
            </div>
          </Link>
        ))}
      </div>

      <div className="workspace-create-board-footer workspace-create-board-footer-studio">
        <div className="workspace-create-board-footnotes">
          <span className="workspace-app-footnote">编排事实源：xyflow</span>
          <span className="workspace-app-footnote">Starter 模板：{starterCount} 个</span>
          <span className="workspace-app-footnote">管理员与成员入口已贯通</span>
        </div>

        {visibleStarterHighlights.length > 0 ? (
          <div className="workspace-create-board-starters">
            <p className="workspace-app-card-caption">Starter 模板精选</p>
            <div className="workspace-create-board-pill-list">
              {visibleStarterHighlights.map((starter) => (
                <Link className="workspace-create-board-starter" href={starter.href} key={starter.id}>
                  <strong>{starter.name}</strong>
                  <span>
                    {starter.priority} · {starter.modeShortLabel}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function WorkspaceEmptyTile({ activeModeLabel }: { activeModeLabel: string | null }) {
  return (
    <article className="workspace-app-card workspace-app-empty-tile workspace-app-card-empty-dify workspace-catalog-card">
      <p className="workspace-app-card-caption">应用列表</p>
      <h3>当前筛选范围内还没有{activeModeLabel ? ` ${activeModeLabel}` : ""}应用</h3>
      <p className="workspace-muted workspace-card-copy">
        先从创建入口发起，或者直接挑一个 Starter 作为起点；创建后继续进入 xyflow 编辑器补齐节点、调试和发布语义。
      </p>
      <div className="workspace-action-row workspace-app-card-actions">
        <Link className="workspace-primary-button compact" href="/workflows/new">
          立即创建
        </Link>
        <Link className="workspace-ghost-button compact" href="/workspace-starters">
          查看 Starter
        </Link>
      </div>
    </article>
  );
}

function WorkspaceAppTile({
  card,
  currentUserDisplayName
}: {
  card: WorkspaceAppCard;
  currentUserDisplayName: string;
}) {
  const signalLabel =
    card.followUpCount > 0
      ? `${card.followUpCount} 个治理待办`
      : card.missingToolCount > 0
        ? `${card.missingToolCount} 个工具缺口`
        : card.healthLabel;
  const appDigest =
    card.followUpCount > 0
      ? `优先处理 ${card.followUpCount} 个治理待办后，再继续进入 xyflow。`
      : card.status === "published"
        ? "已可调用，继续维护版本或从运行诊断核对线上调用。"
        : "草稿已就绪，可直接回到 xyflow 继续补节点和发布配置。";

  return (
    <article
      className="workspace-app-card workspace-app-card-product workspace-app-card-studio workspace-catalog-card"
      key={card.id}
    >
      <div className="workspace-app-card-header workspace-app-card-header-flat workspace-app-card-header-compact">
        <div className="workspace-app-card-identity">
          <div className="workspace-app-icon" aria-hidden="true">
            {getWorkspaceBadgeLabel(card.name, "A")}
          </div>
          <div>
            <div className="workspace-app-card-title-row">
              <h3>{card.name}</h3>
              <span className="workspace-mode-pill">{card.mode.shortLabel}</span>
            </div>
            <p className="workspace-app-subtitle workspace-app-subtitle-dify">
              {currentUserDisplayName} · 最近更新 {formatTimestamp(card.updatedAt)}
            </p>
          </div>
        </div>

        <span className={`workspace-status-pill ${card.status === "published" ? "healthy" : "draft"}`}>
          {card.status === "published" ? "已发布" : "草稿"}
        </span>
      </div>

      <p className="workspace-app-description">{appDigest}</p>

      <div className="workspace-app-inline-metrics workspace-app-inline-metrics-wrap" aria-label={`${card.name} metrics`}>
        <span className="workspace-app-inline-metric">{card.mode.label}</span>
        <span className="workspace-app-inline-metric">{card.nodeCount} 个节点</span>
        <span className="workspace-app-inline-metric">{card.publishCount} 个发布端点</span>
        <span className={`workspace-app-inline-metric ${card.followUpCount > 0 ? "warning" : ""}`}>
          {signalLabel}
        </span>
      </div>

      <div className="workspace-app-footnote-row workspace-app-footnote-row-dify" aria-label={`${card.name} workspace hints`}>
        <span className="workspace-app-footnote">{card.track.focus}</span>
        {card.missingToolCount > 0 ? (
          <span className="workspace-app-footnote">工具缺口：{card.missingToolCount} 个</span>
        ) : null}
      </div>

      <div className="workspace-app-footer workspace-app-footer-inline workspace-app-footer-dify">
        <div className="workspace-action-row workspace-app-card-actions">
          <Link className="workspace-primary-button compact" href={card.href}>
            继续进入 xyflow
          </Link>
          <Link className="workspace-ghost-button compact" href="/runs">
            查看运行
          </Link>
        </div>
      </div>
    </article>
  );
}

export function WorkspaceAppsWorkbench({
  workspaceName,
  canManageMembers,
  currentRoleLabel,
  currentUserDisplayName,
  requestedKeyword,
  activeModeLabel,
  activeModeDescription,
  visibleAppSummary,
  modeTabs,
  scopePills,
  statusFilters,
  workspaceSignals,
  quickCreateEntries,
  starterHighlights,
  starterCount,
  filteredApps,
  searchState
}: WorkspaceAppsWorkbenchProps) {
  const catalogDescription = requestedKeyword
    ? `当前按“${requestedKeyword}”筛选应用；命中后直接进入 xyflow 继续编排。`
    : activeModeLabel
      ? `当前聚焦 ${activeModeLabel}：${activeModeDescription}`
      : "像 Dify 一样先在工作台管理应用入口，再进入 7Flows 的 xyflow 编排主链。";

  return (
    <main className="workspace-main workspace-home-main workspace-home-main-flat workspace-board-page">
      <section className="workspace-studio-shell">
        <section className="workspace-board-hero">
          <div className="workspace-board-hero-copy workspace-studio-header-copy">
            <p className="workspace-eyebrow">Workspace / Apps</p>
            <div className="workspace-board-title-row">
              <h1>{workspaceName} 应用工作台</h1>
              <span className="workspace-tag accent">当前身份：{currentRoleLabel}</span>
            </div>
            <p className="workspace-muted workspace-copy-wide workspace-board-hero-copy-text">
              聚焦应用创建、搜索和继续进入编排；成员权限、运行诊断与治理面保持各自独立入口。
            </p>
            <div className="workspace-hero-action-row">
              <Link className="workspace-primary-button compact" href="/workflows/new">
                + 新建应用
              </Link>
              <Link className="workspace-ghost-button compact" href="/workspace-starters">
                Starter 模板
              </Link>
              {canManageMembers ? (
                <Link className="workspace-ghost-button compact" href="/admin/members">
                  管理成员
                </Link>
              ) : (
                <Link className="workspace-ghost-button compact" href="/runs">
                  查看运行诊断
                </Link>
              )}
            </div>
          </div>

          <div className="workspace-board-hero-side workspace-studio-header-side">
            <WorkspaceSummaryBar compact workspaceSignals={workspaceSignals} />
            <WorkspaceScopePills scopePills={scopePills} />
          </div>
        </section>

        <section className="workspace-board-toolbar-shell workspace-board-toolbar-shell-studio">
          <div className="workspace-mode-tabs workspace-mode-tabs-board" aria-label="App modes">
            {modeTabs.map((modeTab) => (
              <Link className={`workspace-mode-tab ${modeTab.active ? "active" : ""}`} href={modeTab.href} key={modeTab.key}>
                <span>{modeTab.label}</span>
                <strong>{modeTab.count}</strong>
              </Link>
            ))}
          </div>

          <div className="workspace-board-toolbar-row workspace-board-toolbar-row-studio">
            <div className="workspace-filter-row workspace-filter-row-board">
              {statusFilters.map((statusFilter) => (
                <Link
                  className={`workspace-filter-chip ${statusFilter.active ? "active" : ""}`}
                  href={statusFilter.href}
                  key={statusFilter.key}
                >
                  {statusFilter.label}
                </Link>
              ))}
            </div>

            <form action="/workspace" className="workspace-search-form workspace-search-form-board workspace-search-form-studio">
              {searchState.filter ? <input name="filter" type="hidden" value={searchState.filter} /> : null}
              {searchState.mode ? <input name="mode" type="hidden" value={searchState.mode} /> : null}
              {searchState.track ? <input name="track" type="hidden" value={searchState.track} /> : null}
              <input
                className="workspace-search-input workspace-search-input-board"
                defaultValue={requestedKeyword}
                name="keyword"
                placeholder="搜索应用、Agent、工具链或治理焦点"
                type="search"
              />
              <button className="workspace-primary-button compact" type="submit">
                搜索
              </button>
              {searchState.clearHref ? (
                <Link className="workspace-ghost-button compact" href={searchState.clearHref}>
                  清除
                </Link>
              ) : null}
            </form>
          </div>
        </section>

        <section className="workspace-app-section workspace-app-section-dify workspace-catalog-section workspace-catalog-section-studio">
          <div className="workspace-app-section-header workspace-app-section-header-dify workspace-app-section-header-board">
            <div>
              <p className="workspace-eyebrow">Applications</p>
              <h2>应用目录 · {visibleAppSummary}</h2>
              <p className="workspace-muted workspace-copy-wide">{catalogDescription}</p>
            </div>
            <div className="workspace-app-section-actions">
              <Link className="workspace-primary-button compact" href="/workflows/new">
                + 新建应用
              </Link>
              <Link className="workspace-ghost-button compact" href="/workspace-starters">
                Starter 模板
              </Link>
            </div>
          </div>

          <div className="workspace-start-lane">
            <WorkspaceCreateBoardCard
              activeModeDescription={activeModeDescription}
              activeModeLabel={activeModeLabel}
              quickCreateEntries={quickCreateEntries}
              starterCount={starterCount}
              starterHighlights={starterHighlights}
            />

            <WorkspaceStageGuideCard
              activeModeDescription={activeModeDescription}
              activeModeLabel={activeModeLabel}
              canManageMembers={canManageMembers}
              requestedKeyword={requestedKeyword}
            />
          </div>

          <div className="workspace-app-grid workspace-app-grid-board workspace-app-grid-studio">
            {filteredApps.length === 0 ? <WorkspaceEmptyTile activeModeLabel={activeModeLabel} /> : null}

            {filteredApps.map((card) => (
              <WorkspaceAppTile card={card} currentUserDisplayName={currentUserDisplayName} key={card.id} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
