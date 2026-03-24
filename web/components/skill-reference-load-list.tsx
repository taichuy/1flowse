import React from "react";

import type { SkillReferenceLoadItem } from "@/lib/get-run-views";
import { formatJsonPayload } from "@/lib/runtime-presenters";

type SkillReferenceLoadListProps = {
  skillReferenceLoads: SkillReferenceLoadItem[];
  title?: string;
  description?: string;
};

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

const DEFAULT_DESCRIPTION =
  "These are the skill reference bodies actually injected into the agent phase, so operator debugging can distinguish fixed bindings, heuristic matches, and explicit model requests.";

export function SkillReferenceLoadList({
  skillReferenceLoads,
  title = "Skill references",
  description = DEFAULT_DESCRIPTION
}: SkillReferenceLoadListProps) {
  if (skillReferenceLoads.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader
        title={title}
        count={skillReferenceLoads.reduce((total, item) => total + item.references.length, 0)}
      />
      {description ? <p className="section-copy entry-copy">{description}</p> : null}
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
                      {reference.fetch_request_total ? ` / ${reference.fetch_request_total}` : ""}
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
