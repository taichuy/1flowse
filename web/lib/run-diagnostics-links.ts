import type { RunTraceQuery } from "@/lib/get-run-trace";
import { buildRunTraceQueryString } from "@/lib/get-run-trace";
import { buildRunDetailHref } from "@/lib/workbench-links";

export const RUN_DIAGNOSTICS_EXECUTION_VIEW_SECTION_ID = "run-diagnostics-execution-view";
export const RUN_DIAGNOSTICS_EXECUTION_TIMELINE_SECTION_ID =
  "run-diagnostics-execution-timeline";

function buildRunDiagnosticsSectionHref(
  runId: string,
  sectionId: string,
  {
    baseHref,
    traceQuery
  }: {
    baseHref?: string | null;
    traceQuery?: RunTraceQuery | null;
  } = {}
) {
  const url = new URL(baseHref?.trim() || buildRunDetailHref(runId), "https://sevenflows.local");
  const traceSearchParams = new URLSearchParams(buildRunTraceQueryString(traceQuery ?? {}));

  traceSearchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const query = url.searchParams.toString();
  const resolvedHref = query ? `${url.pathname}?${query}` : url.pathname;

  return `${resolvedHref}#${sectionId}`;
}

export function buildRunDiagnosticsExecutionViewHref(runId: string) {
  return buildRunDiagnosticsSectionHref(runId, RUN_DIAGNOSTICS_EXECUTION_VIEW_SECTION_ID);
}

export function buildRunDiagnosticsExecutionTimelineHref(
  runId: string,
  options?: {
    baseHref?: string | null;
    traceQuery?: RunTraceQuery | null;
  }
) {
  return buildRunDiagnosticsSectionHref(
    runId,
    RUN_DIAGNOSTICS_EXECUTION_TIMELINE_SECTION_ID,
    options
  );
}
