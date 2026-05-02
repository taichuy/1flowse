import type {
  AgentFlowDebugMessage,
  AgentFlowDebugMessageStatus,
  AgentFlowTraceItem,
  FlowDebugRunStreamEvent
} from '../../api/runtime';

function nowIso() {
  return new Date().toISOString();
}

function mapFlowStatus(status: string): AgentFlowDebugMessageStatus {
  switch (status) {
    case 'succeeded':
    case 'completed':
      return 'completed';
    case 'waiting_callback':
      return 'waiting_callback';
    case 'waiting_human':
      return 'waiting_human';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'running';
  }
}

function durationMs(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) {
    return null;
  }

  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);

  if (Number.isNaN(started) || Number.isNaN(finished)) {
    return null;
  }

  return Math.max(0, finished - started);
}

function upsertTraceItem(
  items: AgentFlowTraceItem[],
  nextItem: AgentFlowTraceItem
) {
  const index = items.findIndex((item) => item.nodeId === nextItem.nodeId);

  if (index === -1) {
    return [...items, nextItem];
  }

  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...nextItem } : item
  );
}

function extractOutputText(output: Record<string, unknown>) {
  for (const key of ['answer', 'text', 'content', 'message']) {
    const value = output[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return '';
}

export function applyDebugStreamEventToTrace(
  items: AgentFlowTraceItem[],
  event: FlowDebugRunStreamEvent
): AgentFlowTraceItem[] {
  if (event.type === 'node_started') {
    const startedAt = event.started_at ?? nowIso();

    return upsertTraceItem(items, {
      nodeId: event.node_id,
      nodeAlias: event.title,
      nodeType: event.node_type,
      status: 'running',
      startedAt,
      finishedAt: null,
      durationMs: null,
      inputPayload: event.input_payload ?? {},
      outputPayload: {},
      errorPayload: null,
      metricsPayload: {}
    });
  }

  if (event.type === 'node_finished') {
    const existing = items.find((item) => item.nodeId === event.node_id);
    const startedAt = event.started_at ?? existing?.startedAt ?? nowIso();
    const finishedAt = event.finished_at ?? nowIso();

    return upsertTraceItem(items, {
      nodeId: event.node_id,
      nodeAlias: existing?.nodeAlias ?? event.node_id,
      nodeType: existing?.nodeType ?? 'node',
      status: event.status,
      startedAt,
      finishedAt,
      durationMs: durationMs(startedAt, finishedAt),
      inputPayload: existing?.inputPayload ?? {},
      outputPayload: event.output_payload ?? {},
      errorPayload: event.error_payload ?? null,
      metricsPayload: event.metrics_payload ?? {}
    });
  }

  return items;
}

export function applyDebugStreamEventToAssistantMessage(
  message: AgentFlowDebugMessage,
  event: FlowDebugRunStreamEvent,
  traceItems: AgentFlowTraceItem[]
): AgentFlowDebugMessage {
  switch (event.type) {
    case 'flow_accepted':
      return {
        ...message,
        runId: event.run_id,
        status: 'running',
        traceSummary: traceItems
      };
    case 'flow_started':
      return {
        ...message,
        runId: event.run_id,
        status: mapFlowStatus(event.status),
        traceSummary: traceItems
      };
    case 'text_delta':
      return {
        ...message,
        content: `${message.content}${event.text}`
      };
    case 'node_started':
    case 'node_finished':
      return {
        ...message,
        traceSummary: traceItems
      };
    case 'flow_finished':
      return {
        ...message,
        runId: event.run_id,
        status: mapFlowStatus(event.status),
        content: message.content || extractOutputText(event.output),
        rawOutput: event.output,
        traceSummary: traceItems
      };
    case 'flow_failed':
      return {
        ...message,
        runId: event.run_id,
        status: 'failed',
        content: event.error,
        rawOutput: event.error_payload ?? null,
        traceSummary: traceItems
      };
    case 'flow_cancelled':
      return {
        ...message,
        runId: event.run_id,
        status: 'cancelled',
        traceSummary: traceItems
      };
    case 'replay_expired':
      return {
        ...message,
        status: 'failed',
        content: '调试流已过期，请重新运行。'
      };
    default:
      return message;
  }
}
