import {
  buildOperatorTraceSliceLinkSurface,
  type OperatorFollowUpLinkSurface
} from "@/lib/operator-follow-up-presenters";

const TRACE_QUERY_KEYS = new Set([
  "cursor",
  "event_type",
  "node_run_id",
  "created_after",
  "created_before",
  "payload_key",
  "limit",
  "order"
]);

export type TraceDrilldownContext = {
  runId?: string | null;
  runHref?: string | null;
  currentHref?: string | null;
  nodeRunId?: string | null;
};

export type TraceDrilldownToolCallLike = {
  status?: string | null;
  rawRef?: string | null;
  nodeRunId?: string | null;
  executionBlockingReason?: string | null;
};

export type TraceDrilldownArtifactLike = {
  artifactKind?: string | null;
  uri?: string | null;
};

function trimOrNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStatus(value?: string | null) {
  return trimOrNull(value)?.toLowerCase() ?? null;
}

function extractRunIdFromPathname(pathname: string) {
  const prefix = "/runs/";
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const encodedRunId = pathname.slice(prefix.length).trim();
  return encodedRunId ? decodeURIComponent(encodedRunId) : null;
}

export function stripTraceQueryFromHref(href?: string | null) {
  const normalizedHref = trimOrNull(href);
  if (!normalizedHref) {
    return null;
  }

  const url = new URL(normalizedHref, "https://sevenflows.local");
  TRACE_QUERY_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

export function parseTraceDrilldownContextFromHref(
  href?: string | null
): TraceDrilldownContext {
  const normalizedHref = trimOrNull(href);
  if (!normalizedHref) {
    return {};
  }

  const url = new URL(normalizedHref, "https://sevenflows.local");

  return {
    runId: extractRunIdFromPathname(url.pathname),
    runHref: stripTraceQueryFromHref(normalizedHref),
    nodeRunId: trimOrNull(url.searchParams.get("node_run_id"))
  };
}

export function buildToolCallTraceDrilldownLinkSurface(
  context: TraceDrilldownContext,
  toolCall: TraceDrilldownToolCallLike
): OperatorFollowUpLinkSurface | null {
  const normalizedStatus = normalizeStatus(toolCall.status);
  const rawRef = trimOrNull(toolCall.rawRef);

  if (normalizedStatus?.includes("waiting")) {
    return buildOperatorTraceSliceLinkSurface({
      runId: context.runId,
      runHref: context.runHref,
      currentHref: context.currentHref,
      nodeRunId: trimOrNull(toolCall.nodeRunId) ?? trimOrNull(context.nodeRunId),
      eventType: "tool.waiting",
      payloadKey: rawRef ? "raw_ref" : "reason",
      hrefLabel: rawRef ? "open waiting raw_ref trace" : "open waiting trace"
    });
  }

  if (rawRef) {
    return buildOperatorTraceSliceLinkSurface({
      runId: context.runId,
      runHref: context.runHref,
      currentHref: context.currentHref,
      nodeRunId: trimOrNull(toolCall.nodeRunId) ?? trimOrNull(context.nodeRunId),
      eventType: "tool.completed",
      payloadKey: "raw_ref",
      hrefLabel: "open raw_ref trace"
    });
  }

  if (
    normalizedStatus?.includes("blocked") ||
    trimOrNull(toolCall.executionBlockingReason)
  ) {
    return buildOperatorTraceSliceLinkSurface({
      runId: context.runId,
      runHref: context.runHref,
      currentHref: context.currentHref,
      nodeRunId: trimOrNull(toolCall.nodeRunId) ?? trimOrNull(context.nodeRunId),
      eventType: "tool.execution.blocked",
      payloadKey: "reason",
      hrefLabel: "open blocked trace"
    });
  }

  return buildOperatorTraceSliceLinkSurface({
    runId: context.runId,
    runHref: context.runHref,
    currentHref: context.currentHref,
    nodeRunId: trimOrNull(toolCall.nodeRunId) ?? trimOrNull(context.nodeRunId),
    eventType: "tool.completed",
    payloadKey: "summary",
    hrefLabel: "open tool result trace"
  });
}

export function buildArtifactTraceDrilldownLinkSurface(
  context: TraceDrilldownContext,
  artifact: TraceDrilldownArtifactLike,
  toolCalls: TraceDrilldownToolCallLike[] = []
): OperatorFollowUpLinkSurface | null {
  const uri = trimOrNull(artifact.uri);
  const artifactKind = normalizeStatus(artifact.artifactKind);

  if (uri) {
    const matchingToolCall = toolCalls.find(
      (toolCall) => trimOrNull(toolCall.rawRef) === uri
    );
    if (matchingToolCall) {
      return buildToolCallTraceDrilldownLinkSurface(context, matchingToolCall);
    }
  }

  if (artifactKind === "evidence_pack") {
    return buildOperatorTraceSliceLinkSurface({
      runId: context.runId,
      runHref: context.runHref,
      currentHref: context.currentHref,
      nodeRunId: trimOrNull(context.nodeRunId),
      eventType: "assistant.completed",
      payloadKey: "evidence_ref",
      hrefLabel: "open evidence_ref trace"
    });
  }

  if (artifactKind === "tool_result" || artifactKind === "sandbox_result") {
    return buildOperatorTraceSliceLinkSurface({
      runId: context.runId,
      runHref: context.runHref,
      currentHref: context.currentHref,
      nodeRunId: trimOrNull(context.nodeRunId),
      eventType: "tool.completed",
      payloadKey: "raw_ref",
      hrefLabel: "open artifact trace"
    });
  }

  return buildOperatorTraceSliceLinkSurface({
    runId: context.runId,
    runHref: context.runHref,
    currentHref: context.currentHref,
    nodeRunId: trimOrNull(context.nodeRunId),
    hrefLabel: "open artifact trace"
  });
}

export function buildEvidenceSourceTraceDrilldownLinkSurface(
  context: TraceDrilldownContext,
  sourceRef?: string | null,
  artifacts: TraceDrilldownArtifactLike[] = [],
  toolCalls: TraceDrilldownToolCallLike[] = []
): OperatorFollowUpLinkSurface | null {
  const normalizedSourceRef = trimOrNull(sourceRef);
  if (!normalizedSourceRef) {
    return null;
  }

  const matchingToolCall = toolCalls.find(
    (toolCall) => trimOrNull(toolCall.rawRef) === normalizedSourceRef
  );
  if (matchingToolCall) {
    return buildToolCallTraceDrilldownLinkSurface(context, matchingToolCall);
  }

  const matchingArtifact = artifacts.find(
    (artifact) => trimOrNull(artifact.uri) === normalizedSourceRef
  );
  if (matchingArtifact) {
    return buildArtifactTraceDrilldownLinkSurface(context, matchingArtifact, toolCalls);
  }

  return buildOperatorTraceSliceLinkSurface({
    runId: context.runId,
    runHref: context.runHref,
    currentHref: context.currentHref,
    nodeRunId: trimOrNull(context.nodeRunId),
    hrefLabel: "open source trace"
  });
}
