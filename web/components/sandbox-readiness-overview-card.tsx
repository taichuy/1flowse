import React from "react";

import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import {
  formatSandboxReadinessDetail,
  formatSandboxReadinessHeadline,
  listSandboxAvailableClasses,
  listSandboxBlockedClasses,
  listSandboxReadinessCapabilityChips
} from "@/lib/sandbox-readiness-presenters";

type SandboxReadinessOverviewCardProps = {
  readiness?: SandboxReadinessCheck | null;
  title?: string;
  intro?: string | null;
  hideWhenHealthy?: boolean;
};

export function SandboxReadinessOverviewCard({
  readiness,
  title = "Live sandbox readiness",
  intro = null,
  hideWhenHealthy = false
}: SandboxReadinessOverviewCardProps) {
  if (!readiness) {
    return null;
  }

  const availableClasses = listSandboxAvailableClasses(readiness);
  const blockedEntries = listSandboxBlockedClasses(readiness);
  const blockedClasses = blockedEntries.map((entry) => entry.execution_class);
  const hasOperationalRisk =
    blockedClasses.length > 0 ||
    readiness.offline_backend_count > 0 ||
    readiness.degraded_backend_count > 0;

  if (hideWhenHealthy && !hasOperationalRisk) {
    return null;
  }

  const chips = Array.from(
    new Set([
      ...availableClasses.map((executionClass) => `ready ${executionClass}`),
      ...blockedClasses.map((executionClass) => `blocked ${executionClass}`),
      ...listSandboxReadinessCapabilityChips(readiness)
    ])
  );
  const toneClass =
    blockedClasses.length > 0
      ? "trace-export-blocked"
      : hasOperationalRisk
        ? "pending"
        : "healthy";
  const statusLabel =
    blockedClasses.length > 0 ? "blocked" : hasOperationalRisk ? "degraded" : "ready";

  return (
    <article className="payload-card compact-card">
      <div className="payload-card-header">
        <span className="status-meta">{title}</span>
        <span className={`event-chip ${toneClass}`}>{statusLabel}</span>
      </div>
      {intro ? <p className="section-copy entry-copy">{intro}</p> : null}
      <p className="binding-meta">{formatSandboxReadinessHeadline(readiness)}</p>
      {formatSandboxReadinessDetail(readiness) ? (
        <p className="section-copy entry-copy">{formatSandboxReadinessDetail(readiness)}</p>
      ) : null}
      {chips.length > 0 ? (
        <div className="tool-badge-row">
          {chips.map((chip) => (
            <span className="event-chip" key={`${title}-${chip}`}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
