import Link from "next/link";
import type { ReactNode } from "react";

import type {
  AICallItem,
  RunArtifactItem,
  RunCallbackTicketItem,
  SkillReferenceLoadItem,
  ToolCallItem
} from "@/lib/get-run-views";
import { buildCallbackTicketInboxHref } from "@/lib/callback-ticket-links";
import { listCallbackTicketDetailRows } from "@/lib/callback-waiting-presenters";
import { formatDurationMs, formatJsonPayload } from "@/lib/runtime-presenters";

import { ArtifactPreviewList } from "@/components/run-diagnostics-execution/shared";

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="section-heading compact-heading">
      <div>
        <span className="binding-label">{title}</span>
      </div>
      <div className="tool-badge-row">
        <span className="event-chip">count {count}</span>
      </div>
    </div>
  );
}

export function ExecutionNodeToolCallList({ toolCalls }: { toolCalls: ToolCallItem[] }) {
  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader title="Tool calls" count={toolCalls.length} />
      <div className="event-list">
        {toolCalls.map((toolCall) => (
          <article className="event-row compact-card" key={toolCall.id}>
            <div className="event-meta">
              <span>{toolCall.tool_name}</span>
              <span>{toolCall.status}</span>
            </div>
            <p className="event-run">
              {toolCall.phase} · {formatDurationMs(toolCall.latency_ms)} · tool {toolCall.tool_id}
            </p>
            <pre>
              {formatJsonPayload({
                request_summary: toolCall.request_summary,
                response_summary: toolCall.response_summary,
                raw_ref: toolCall.raw_ref
              })}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExecutionNodeAiCallList({ aiCalls }: { aiCalls: AICallItem[] }) {
  if (aiCalls.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader title="AI calls" count={aiCalls.length} />
      <div className="event-list">
        {aiCalls.map((aiCall) => (
          <article className="event-row compact-card" key={aiCall.id}>
            <div className="event-meta">
              <span>{aiCall.role}</span>
              <span>{aiCall.status}</span>
            </div>
            <p className="event-run">
              {aiCall.provider ?? "provider?"} · {aiCall.model_id ?? "model?"} · {formatDurationMs(aiCall.latency_ms)}
            </p>
            <pre>
              {formatJsonPayload({
                input_summary: aiCall.input_summary,
                output_summary: aiCall.output_summary,
                assistant: aiCall.assistant,
                token_usage: aiCall.token_usage
              })}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExecutionNodeSkillReferenceLoadList({
  skillReferenceLoads
}: {
  skillReferenceLoads: SkillReferenceLoadItem[];
}) {
  if (skillReferenceLoads.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader
        title="Skill references"
        count={skillReferenceLoads.reduce((total, item) => total + item.references.length, 0)}
      />
      <p className="section-copy entry-copy">
        These are the skill reference bodies actually injected into the agent phase, so operator
        debugging can distinguish fixed bindings, heuristic matches, and explicit model requests.
      </p>
      <div className="event-list">
        {skillReferenceLoads.map((load, index) => (
          <article className="event-row compact-card" key={`${load.phase}-${index}`}>
            <div className="event-meta">
              <span>{load.phase}</span>
              <span>{load.references.length} loaded</span>
            </div>
            <div className="event-list">
              {load.references.map((reference) => (
                <article
                  className="event-row compact-card"
                  key={`${reference.skill_id}:${reference.reference_id}:${reference.load_source}`}
                >
                  <div className="event-meta">
                    <span>{reference.reference_name ?? reference.reference_id}</span>
                    <span>{reference.load_source}</span>
                  </div>
                  <p className="event-run">
                    {reference.skill_name ?? reference.skill_id} · ref {reference.reference_id}
                  </p>
                  {reference.fetch_reason ? (
                    <p className="section-copy entry-copy">Reason: {reference.fetch_reason}</p>
                  ) : null}
                  {reference.fetch_request_index ? (
                    <p className="section-copy entry-copy">
                      Request round {reference.fetch_request_index}
                      {reference.fetch_request_total
                        ? ` / ${reference.fetch_request_total}`
                        : ""}
                    </p>
                  ) : null}
                  <pre>
                    {formatJsonPayload({
                      fetch_reason: reference.fetch_reason,
                      fetch_request_index: reference.fetch_request_index,
                      fetch_request_total: reference.fetch_request_total,
                      retrieval_http_path: reference.retrieval_http_path,
                      retrieval_mcp_method: reference.retrieval_mcp_method,
                      retrieval_mcp_params: reference.retrieval_mcp_params
                    })}
                  </pre>
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExecutionNodeCallbackTicketList({
  callbackTickets
}: {
  callbackTickets: RunCallbackTicketItem[];
}) {
  if (callbackTickets.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader title="Callback tickets" count={callbackTickets.length} />
      <div className="event-list">
        {callbackTickets.map((ticket) => {
          const inboxHref = buildCallbackTicketInboxHref(ticket);
          const detailRows = listCallbackTicketDetailRows(ticket, { mode: "compact" });
          return (
            <article className="event-row compact-card" key={ticket.ticket}>
              <div className="event-meta">
                <span>{ticket.status}</span>
                <span>{ticket.waiting_status}</span>
              </div>
              <p className="event-run">
                ticket {ticket.ticket} · tool {ticket.tool_id ?? "n/a"}
              </p>
              {inboxHref ? (
                <div className="tool-badge-row">
                  <Link className="event-chip inbox-filter-link" href={inboxHref}>
                    open inbox slice
                  </Link>
                </div>
              ) : null}
              {detailRows.map((row) => (
                <p className="section-copy entry-copy" key={`${ticket.ticket}:${row.label}`}>
                  {row.label}: {row.value}
                </p>
              ))}
              <pre>
                {formatJsonPayload({
                  callback_payload: ticket.callback_payload,
                  tool_call_id: ticket.tool_call_id
                })}
              </pre>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ExecutionNodeArtifactSection({ artifacts }: { artifacts: RunArtifactItem[] }) {
  if (artifacts.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader title="Artifacts" count={artifacts.length} />
      <ArtifactPreviewList artifacts={artifacts} />
    </section>
  );
}

export function ExecutionNodeSensitiveAccessSection({
  children,
  count
}: {
  children: ReactNode;
  count: number;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader title="Sensitive access timeline" count={count} />
      <p className="section-copy entry-copy">
        Approval tickets, notification delivery and policy decisions stay grouped here so operator
        triage can continue without leaving the execution node.
      </p>
      {children}
    </section>
  );
}
