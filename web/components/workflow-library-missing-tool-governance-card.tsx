import Link from "next/link";

import { WorkflowGovernanceHandoffCards } from "@/components/workflow-governance-handoff-cards";
import type { WorkflowListItem } from "@/lib/get-workflows";
import {
  formatCatalogGapSummary,
  formatCatalogGapToolSummary,
  getWorkflowMissingToolIds
} from "@/lib/workflow-definition-governance";
import { buildWorkflowGovernanceHandoff } from "@/lib/workflow-governance-handoff";

type WorkflowLibraryMissingToolGovernanceCardProps = {
  workflows: WorkflowListItem[];
  workflowDetailHrefsById: Record<string, string>;
  workflowLibraryFilterHref: string;
};

type MissingToolWorkflowEntry = {
  workflow: WorkflowListItem;
  missingToolIds: string[];
};

export function WorkflowLibraryMissingToolGovernanceCard({
  workflows,
  workflowDetailHrefsById,
  workflowLibraryFilterHref
}: WorkflowLibraryMissingToolGovernanceCardProps) {
  const entries = workflows
    .map<MissingToolWorkflowEntry>((workflow) => ({
      workflow,
      missingToolIds: getWorkflowMissingToolIds(workflow)
    }))
    .filter((entry) => entry.missingToolIds.length > 0);

  if (entries.length === 0) {
    return null;
  }

  const totalMissingBindingCount = entries.reduce(
    (count, entry) => count + entry.missingToolIds.length,
    0
  );
  const uniqueMissingToolIds = Array.from(
    new Set(entries.flatMap((entry) => entry.missingToolIds))
  );
  const primaryEntry = entries[0];
  const remainingWorkflowCount = Math.max(entries.length - 1, 0);
  const primaryEntryWorkflowHref = workflowDetailHrefsById[primaryEntry.workflow.id] ?? null;
  const primaryEntryWorkflowGovernanceHandoff = buildWorkflowGovernanceHandoff({
    workflowId: primaryEntry.workflow.id,
    workflowName: primaryEntry.workflow.name,
    workflowDetailHref: primaryEntryWorkflowHref,
    toolGovernance: primaryEntry.workflow.tool_governance,
    legacyAuthGovernance: primaryEntry.workflow.legacy_auth_governance ?? null,
    workflowCatalogGapDetail: buildPrimaryFollowUpDetail(primaryEntry, remainingWorkflowCount)
  });
  const workflowHandoffEntries = entries.map((entry) => {
    const workflowHref = workflowDetailHrefsById[entry.workflow.id] ?? null;

    return {
      entry,
      workflowHref,
      workflowGovernanceHandoff: buildWorkflowGovernanceHandoff({
        workflowId: entry.workflow.id,
        workflowName: entry.workflow.name,
        workflowDetailHref: workflowHref,
        toolGovernance: entry.workflow.tool_governance,
        legacyAuthGovernance: entry.workflow.legacy_auth_governance ?? null,
        workflowCatalogGapDetail: buildWorkflowHandoffDetail(entry)
      })
    };
  });

  return (
    <article className="payload-card compact-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Missing tool governance</p>
          <h3>跨 workflow catalog gap handoff</h3>
        </div>
        <p className="section-copy">
          workflow detail 已能按单个 workflow fail-close 缺失 tool binding；workflow
          library 继续把当前范围里的 catalog gap 汇成共享 handoff，避免作者和 AI 只看到
          missing-tool 计数，却还得逐个打开 detail 才知道先处理谁。
        </p>
      </div>

      <div className="summary-strip compact-strip">
        <article className="summary-card">
          <span>Affected workflows</span>
          <strong>{entries.length}</strong>
        </article>
        <article className="summary-card">
          <span>Missing bindings</span>
          <strong>{totalMissingBindingCount}</strong>
        </article>
        <article className="summary-card">
          <span>Catalog gaps</span>
          <strong>{uniqueMissingToolIds.length}</strong>
        </article>
      </div>

      <div className="publish-key-list">
        <div>
          <p className="entry-card-title">Primary follow-up</p>
          <p className="section-copy entry-copy">
            先处理当前范围里最先暴露出来的 catalog gap，再沿同一份 workflow handoff
            继续收口其余 missing-tool workflow。
          </p>
        </div>

        <article className="payload-card compact-card">
          <div className="payload-card-header">
            <span className="status-meta">
              {formatCatalogGapSummary(primaryEntry.missingToolIds, 3) ?? "catalog gap"}
            </span>
            {primaryEntryWorkflowHref ? (
              <Link
                className="event-chip inbox-filter-link"
                href={primaryEntryWorkflowHref}
              >
                回到 workflow 编辑器
              </Link>
            ) : null}
          </div>
          <p className="binding-meta">{primaryEntry.workflow.name}</p>
          <p className="section-copy entry-copy">{buildWorkflowMetadataDetail(primaryEntry)}</p>
          <div className="event-type-strip">
            {renderMissingToolChips(primaryEntry.missingToolIds)}
          </div>
        </article>

        <WorkflowGovernanceHandoffCards
          workflowCatalogGapSummary={primaryEntryWorkflowGovernanceHandoff.workflowCatalogGapSummary}
          workflowCatalogGapDetail={primaryEntryWorkflowGovernanceHandoff.workflowCatalogGapDetail}
          workflowCatalogGapHref={primaryEntryWorkflowGovernanceHandoff.workflowCatalogGapHref}
          workflowGovernanceHref={primaryEntryWorkflowGovernanceHandoff.workflowGovernanceHref}
          legacyAuthHandoff={primaryEntryWorkflowGovernanceHandoff.legacyAuthHandoff}
          cardClassName="payload-card compact-card"
        />
      </div>

      <div className="publish-key-list">
        <div>
          <p className="entry-card-title">Workflow handoff</p>
          <p className="section-copy entry-copy">
            每个条目都保留 workflow 级 missing-tool 事实与 scoped entry，方便作者、AI
            和 operator 在同一页直接继续 follow-up。
          </p>
        </div>

        {workflowHandoffEntries.map(({ entry, workflowHref, workflowGovernanceHandoff }) => {
          return (
            <div key={entry.workflow.id}>
              <article className="payload-card compact-card">
                <div className="payload-card-header">
                  <span className="status-meta">
                    {formatCatalogGapSummary(entry.missingToolIds, 3) ?? "catalog gap"}
                  </span>
                  {workflowHref ? (
                    <Link className="event-chip inbox-filter-link" href={workflowHref}>
                      回到 workflow 编辑器
                    </Link>
                  ) : null}
                </div>
                <p className="binding-meta">{entry.workflow.name}</p>
                <p className="section-copy entry-copy">{buildWorkflowMetadataDetail(entry)}</p>
                <div className="event-type-strip">
                  {renderMissingToolChips(entry.missingToolIds)}
                </div>
              </article>

              <WorkflowGovernanceHandoffCards
                workflowCatalogGapSummary={workflowGovernanceHandoff.workflowCatalogGapSummary}
                workflowCatalogGapDetail={workflowGovernanceHandoff.workflowCatalogGapDetail}
                workflowCatalogGapHref={workflowGovernanceHandoff.workflowCatalogGapHref}
                workflowGovernanceHref={workflowGovernanceHandoff.workflowGovernanceHref}
                legacyAuthHandoff={workflowGovernanceHandoff.legacyAuthHandoff}
                cardClassName="payload-card compact-card"
              />
            </div>
          );
        })}
      </div>

      <div className="binding-actions">
        <div>
          <p className="entry-card-title">Scope to blockers</p>
          <p className="section-copy entry-copy">
            回到只含 missing-tool workflow 的列表范围，继续按 catalog gap 逐个补齐 binding。
          </p>
        </div>
        <Link className="activity-link" href={workflowLibraryFilterHref}>
          只看 missing-tool workflow
        </Link>
      </div>
    </article>
  );
}

function buildPrimaryFollowUpDetail(
  entry: MissingToolWorkflowEntry,
  remainingWorkflowCount: number
) {
  const missingToolCopy = formatCatalogGapToolSummary(entry.missingToolIds, 3) ?? "unknown tool";

  if (remainingWorkflowCount > 0) {
    return (
      `当前 workflow 仍有 catalog gap（${missingToolCopy}）；` +
      `先回 editor 补齐 binding，再继续排查剩余 ${remainingWorkflowCount} 个 workflow。`
    );
  }

  return (
    `当前 workflow 仍有 catalog gap（${missingToolCopy}）；` +
    "补齐 binding 后即可清空当前范围里的 missing-tool backlog。"
  );
}

function buildWorkflowHandoffDetail(entry: MissingToolWorkflowEntry) {
  const catalogGapSummary = formatCatalogGapSummary(entry.missingToolIds, 3) ?? "catalog gap";

  return `${buildWorkflowMetadataDetail(entry)} 当前 workflow 仍有 ${catalogGapSummary}。`;
}

function buildWorkflowMetadataDetail(entry: MissingToolWorkflowEntry) {
  const governedToolCount = entry.workflow.tool_governance?.governed_tool_count ?? 0;

  return `${entry.workflow.version} · ${entry.workflow.status} · ${entry.workflow.node_count} nodes · ${governedToolCount} governed tools。`;
}

function renderMissingToolChips(missingToolIds: string[]) {
  return Array.from(new Set(missingToolIds)).slice(0, 4).map((toolId) => (
    <span className="event-chip" key={toolId}>
      {toolId}
    </span>
  ));
}
