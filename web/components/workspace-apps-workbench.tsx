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
  workspaceUtilityEntry: WorkspaceQuickCreateEntry | null;
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

function getWorkspaceScopeSummary({
  activeModeDescription,
  activeModeLabel,
  requestedKeyword
}: {
  activeModeDescription: string;
  activeModeLabel: string | null;
  requestedKeyword: string;
}) {
  return requestedKeyword
    ? `已按“${requestedKeyword}”聚焦应用`
    : activeModeLabel
      ? `当前筛选：${activeModeLabel}`
      : "当前展示全部应用";
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

function WorkspaceBrowseRail({
  currentScopeSummary,
  modeTabs,
  statusFilters,
  workspaceSignals,
  scopePills,
  variant = "rail"
}: {
  currentScopeSummary: string;
  modeTabs: WorkspaceModeTab[];
  statusFilters: WorkspaceStatusFilter[];
  workspaceSignals: WorkspaceSignal[];
  scopePills: WorkspaceScopePill[];
  variant?: "rail" | "inline";
}) {
  const isInline = variant === "inline";

  return (
    <section
      className={`workspace-filter-rail workspace-catalog-card ${isInline ? "workspace-filter-rail-inline" : ""}`.trim()}
      aria-label="Workspace filters"
    >
      <div
        className={`workspace-filter-rail-header ${isInline ? "workspace-filter-rail-header-inline" : ""}`.trim()}
      >
        <div className="workspace-filter-rail-copy">
          <p className="workspace-app-card-caption">Directory</p>
          <h2>{isInline ? "应用目录" : "筛选应用"}</h2>
          <p className="workspace-muted workspace-card-copy">{currentScopeSummary}</p>
        </div>

        {isInline ? (
          <div className="workspace-filter-rail-signal-grid workspace-filter-rail-signal-grid-inline">
            {workspaceSignals.map((signal) => (
              <article className="workspace-filter-rail-signal" key={signal.label}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`workspace-filter-rail-body ${isInline ? "workspace-filter-rail-body-inline" : ""}`.trim()}>
        <div className="workspace-filter-rail-group">
          <span className="workspace-filter-rail-label">应用类型</span>
          <div className="workspace-filter-rail-tab-list" aria-label="App modes">
            {modeTabs.map((modeTab) => (
              <Link
                className={`workspace-filter-rail-tab ${modeTab.active ? "active" : ""}`.trim()}
                href={modeTab.href}
                key={modeTab.key}
              >
                <span>{modeTab.label}</span>
                <strong>{modeTab.count}</strong>
              </Link>
            ))}
          </div>
        </div>

        <div className="workspace-filter-rail-group">
          <span className="workspace-filter-rail-label">状态</span>
          <div className="workspace-filter-row workspace-filter-row-board workspace-filter-rail-chip-list">
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
        </div>
      </div>

      {!isInline ? (
        <div className="workspace-filter-rail-group">
          <span className="workspace-filter-rail-label">工作台信号</span>
          <div className="workspace-filter-rail-signal-grid">
            {workspaceSignals.map((signal) => (
              <article className="workspace-filter-rail-signal" key={signal.label}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {scopePills.length > 0 ? <WorkspaceScopePills scopePills={scopePills} /> : null}
    </section>
  );
}

function WorkspaceCreateRail({
  activeModeDescription,
  activeModeLabel,
  quickCreateEntries,
  starterHighlights,
  requestedKeyword,
  starterCount,
  workspaceUtilityEntry,
  variant = "rail"
}: {
  activeModeDescription: string;
  activeModeLabel: string | null;
  quickCreateEntries: WorkspaceQuickCreateEntry[];
  starterHighlights: WorkspaceStarterHighlight[];
  requestedKeyword: string;
  starterCount: number;
  workspaceUtilityEntry: WorkspaceQuickCreateEntry | null;
  variant?: "rail" | "stage";
}) {
  const primaryStarter = starterHighlights[0] ?? null;
  const [primaryEntry, ...secondaryEntries] = quickCreateEntries;
  const currentScopeSummary = getWorkspaceScopeSummary({
    activeModeDescription,
    activeModeLabel,
    requestedKeyword
  });
  const isStageVariant = variant === "stage";
  const summaryCopy = requestedKeyword
    ? `${currentScopeSummary}，命中后直接继续进入 xyflow。`
    : isStageVariant
      ? "把空白应用、Starter 模板和团队协作入口压成一条创建带，创建后直接进入 xyflow。"
      : activeModeDescription;

  return (
    <div
      className={`workspace-create-rail workspace-catalog-card workspace-create-rail-${variant}`}
      aria-label="Workspace create actions"
    >
      <div className="workspace-create-rail-header">
        <div className="workspace-create-rail-copy">
          <p className="workspace-app-card-caption">Create</p>
          <h3>{activeModeLabel ? `${activeModeLabel} 创建入口` : "创建应用"}</h3>
          <p className="workspace-muted workspace-card-copy workspace-create-rail-summary">{summaryCopy}</p>
        </div>

        <div className="workspace-create-rail-header-side">
          <span className="workspace-app-footnote">Starter 模板：{starterCount} 个</span>
          <span className="workspace-app-footnote">{requestedKeyword ? `当前搜索：${requestedKeyword}` : "创建后直达 xyflow"}</span>
        </div>
      </div>

      <div className={`workspace-create-action-cluster workspace-create-action-cluster-${variant}`}>
        {primaryEntry ? (
          <Link className="workspace-create-primary-row" href={primaryEntry.href}>
            <div>
              <strong>{primaryEntry.title}</strong>
              <p>{primaryEntry.detail}</p>
            </div>
            <span className="workspace-create-row-arrow">{primaryEntry.badge}</span>
          </Link>
        ) : null}

        <div className="workspace-create-secondary-list">
          {secondaryEntries.map((entry) => (
            <Link className="workspace-create-secondary-row" href={entry.href} key={entry.title}>
              <div>
                <strong>{entry.title}</strong>
                <p>{entry.detail}</p>
              </div>
              <span>{entry.badge}</span>
            </Link>
          ))}

          {workspaceUtilityEntry ? (
            <Link className="workspace-create-secondary-row" href={workspaceUtilityEntry.href}>
              <div>
                <strong>{workspaceUtilityEntry.title}</strong>
                <p>{workspaceUtilityEntry.detail}</p>
              </div>
              <span>{workspaceUtilityEntry.badge}</span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="workspace-create-rail-footer">
        <div className="workspace-create-rail-footnotes">
          <span className="workspace-app-footnote">主区只保留目录行与进入 Studio 的下一步</span>
        </div>

        {primaryStarter ? (
          <Link className="workspace-create-recommend-row" href={primaryStarter.href}>
            <span className="workspace-create-recommend-label">推荐起点</span>
            <strong>{primaryStarter.name}</strong>
            <span>
              {primaryStarter.priority} · {primaryStarter.modeShortLabel} · {primaryStarter.description}
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceAppListColumns() {
  return (
    <div className="workspace-app-list-columns" aria-hidden="true">
      <span>应用</span>
      <span>模式</span>
      <span>状态</span>
      <span>治理 / 下一步</span>
      <span>操作</span>
    </div>
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
  const showSignalLabel = card.followUpCount > 0 || card.status === "published";
  const appDigest =
    card.status === "published"
      ? "已发布，可继续从 Studio 维护版本并回到运行入口核对状态。"
      : card.followUpCount > 0
        ? `治理优先：${card.recommendedNextStep}`
        : "草稿已就绪，继续进入 xyflow 补首个业务节点与应用配置。";
  const publishLabel = card.publishCount > 0 ? `${card.publishCount} 个发布端点` : "未发布";
  const governanceLabel =
    card.followUpCount > 0
      ? `${card.followUpCount} 项待治理`
      : card.missingToolCount > 0
        ? `${card.missingToolCount} 个工具缺口`
        : signalLabel;

  return (
    <article className="workspace-app-row workspace-catalog-card" key={card.id}>
      <div className="workspace-app-row-cell workspace-app-row-cell-primary">
        <div className="workspace-app-card-identity workspace-app-row-identity">
          <div className="workspace-app-icon" aria-hidden="true">
            {getWorkspaceBadgeLabel(card.name, "A")}
          </div>
          <div>
            <div className="workspace-app-card-title-row workspace-app-row-title-row">
              <h3>{card.name}</h3>
            </div>
            <p className="workspace-app-subtitle workspace-app-subtitle-dify workspace-app-subtitle-compact">
              {card.nodeCount} 个节点 · {currentUserDisplayName}
            </p>
            <p className="workspace-muted workspace-app-row-updated">最近更新 {formatTimestamp(card.updatedAt)}</p>
          </div>
        </div>
      </div>

      <div className="workspace-app-row-cell workspace-app-row-cell-mode">
        <span className="workspace-mode-pill">{card.mode.shortLabel}</span>
        <span className="workspace-app-row-track">{card.track.focus}</span>
        <span className="workspace-app-footnote">{publishLabel}</span>
      </div>

      <div className="workspace-app-row-cell workspace-app-row-cell-status">
        <span className={`workspace-status-pill ${card.status === "published" ? "healthy" : "draft"}`}>
          {card.status === "published" ? "已发布" : "草稿"}
        </span>
        <span className={`workspace-app-inline-metric workspace-app-row-signal ${card.followUpCount > 0 ? "warning" : ""}`}>
          {showSignalLabel ? signalLabel : governanceLabel}
        </span>
      </div>

      <div className="workspace-app-row-cell workspace-app-row-cell-summary">
        <div className="workspace-app-meta-row workspace-app-row-meta" aria-label={`${card.name} workspace hints`}>
          <span className="workspace-app-meta-pill">{card.track.focus}</span>
          {card.missingToolCount > 0 ? <span className="workspace-app-meta-pill warning">工具缺口：{card.missingToolCount}</span> : null}
        </div>
        <p className="workspace-muted workspace-app-row-helper">{appDigest}</p>
      </div>

      <div className="workspace-app-row-cell workspace-app-row-cell-actions">
        <Link className="workspace-primary-button compact" href={card.href}>
          进入 Studio
        </Link>
        <Link className="workspace-ghost-button compact" href="/runs">
          查看运行
        </Link>
      </div>
    </article>
  );
}

export function WorkspaceAppsWorkbench({
  workspaceName,
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
  workspaceUtilityEntry,
  starterHighlights,
  starterCount,
  filteredApps,
  searchState
}: WorkspaceAppsWorkbenchProps) {
  const currentScopeSummary = getWorkspaceScopeSummary({
    activeModeDescription,
    activeModeLabel,
    requestedKeyword
  });
  const catalogDescription = requestedKeyword
    ? `当前按“${requestedKeyword}”筛选应用；命中后直接进入 xyflow 继续编排。`
    : activeModeLabel
      ? `当前聚焦 ${activeModeLabel}，继续创建或进入 Studio。`
      : "像 Dify 一样先浏览目录，再创建或继续进入 Studio。";

  return (
    <main className="workspace-main workspace-home-main workspace-home-main-flat workspace-board-page">
      <section className="workspace-apps-dify-shell">
        <section className="workspace-apps-dify-stage">
          <section className="workspace-apps-stage-header workspace-catalog-card">
            <div className="workspace-apps-stage-copy">
              <p className="workspace-eyebrow">Workspace / Apps</p>
              <div className="workspace-apps-stage-title-row">
                <h1>{workspaceName} 应用工作台</h1>
                <span className="workspace-tag accent">当前身份：{currentRoleLabel}</span>
              </div>
              <p className="workspace-muted workspace-apps-stage-copy-text">{catalogDescription}</p>
            </div>

            <form action="/workspace" className="workspace-search-form workspace-search-form-board workspace-search-form-studio workspace-apps-stage-search">
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
          </section>

          <WorkspaceBrowseRail
            currentScopeSummary={currentScopeSummary}
            modeTabs={modeTabs}
            scopePills={scopePills}
            statusFilters={statusFilters}
            variant="inline"
            workspaceSignals={workspaceSignals}
          />

          <WorkspaceCreateRail
            activeModeDescription={activeModeDescription}
            activeModeLabel={activeModeLabel}
            quickCreateEntries={quickCreateEntries}
            requestedKeyword={requestedKeyword}
            starterCount={starterCount}
            starterHighlights={starterHighlights}
            variant="stage"
            workspaceUtilityEntry={workspaceUtilityEntry}
          />

          <section className="workspace-app-section workspace-app-section-dify workspace-catalog-section workspace-catalog-section-studio">
            <div className="workspace-app-list-stage-header">
              <div>
                <p className="workspace-app-list-stage-summary">{visibleAppSummary}</p>
                <p className="workspace-muted workspace-app-list-stage-copy">
                  目录行只保留状态、治理信号和进入 Studio 的下一步。
                </p>
              </div>
            </div>

            {filteredApps.length > 0 ? <WorkspaceAppListColumns /> : null}

            <div className="workspace-app-list-shell">
              {filteredApps.length === 0 ? <WorkspaceEmptyTile activeModeLabel={activeModeLabel} /> : null}

              {filteredApps.map((card) => (
                <WorkspaceAppTile card={card} currentUserDisplayName={currentUserDisplayName} key={card.id} />
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
