import Link from "next/link";

import type { WorkflowPublishedEndpointItem } from "@/lib/get-workflow-publish";
import {
  buildWorkflowApiBindingDoc,
  selectPublishedWorkflowBindings
} from "@/lib/workflow-api-surface";

type WorkflowApiSurfaceProps = {
  bindings: WorkflowPublishedEndpointItem[];
  publishHref: string;
};

export function WorkflowApiSurface({ bindings, publishHref }: WorkflowApiSurfaceProps) {
  const publishedBindings = selectPublishedWorkflowBindings(bindings);
  const nonPublishedCount = Math.max(bindings.length - publishedBindings.length, 0);

  if (publishedBindings.length === 0) {
    const hasDraftBindings = bindings.some((binding) => binding.lifecycle_status === "draft");

    return (
      <div
        className="workspace-panel workflow-api-empty-state"
        data-component="workflow-api-empty-state"
      >
        <p className="workflow-studio-placeholder-eyebrow">Published contract</p>
        <h2>访问 API</h2>
        <p>
          {hasDraftBindings
            ? "当前 workflow 只有 draft / offline publish definition；请先到发布治理完成正式发布，再回来查看可对接的 API contract。"
            : "当前 workflow 还没有 published binding；请先完成发布治理，再把真实 contract 暴露给外部调用方。"}
        </p>
        <div className="workflow-studio-placeholder-actions">
          <Link className="workflow-studio-secondary-link" href={publishHref}>
            前往发布治理
          </Link>
          <Link className="workflow-studio-secondary-link" href="/runs">
            查看运行诊断
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-api-surface" data-component="workflow-api-surface">
      <section className="workspace-panel workflow-api-surface-header-panel">
        <div className="workspace-surface-header">
          <div className="workspace-surface-copy workspace-copy-wide">
            <p className="workflow-studio-placeholder-eyebrow">Published contract</p>
            <h2>访问 API</h2>
            <p>
              当前页面直接消费 workflow 已发布 binding 的真实 contract：展示 base URL、auth
              mode、协议入口与最小请求示例，避免再从 publish 表单或外部记忆倒推调用方式。
            </p>
          </div>
          <div className="workspace-surface-actions workflow-api-surface-actions">
            <Link className="workflow-studio-secondary-link" href={publishHref}>
              前往发布治理
            </Link>
          </div>
        </div>

        <div className="workspace-overview-strip">
          <article className="workspace-stat-card">
            <span>Published bindings</span>
            <strong>{publishedBindings.length}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>Other definitions</span>
            <strong>{nonPublishedCount}</strong>
          </article>
          <article className="workspace-stat-card workspace-stat-card-wide">
            <span>Contract scope</span>
            <strong>只展示 active published bindings</strong>
            <p className="workspace-stat-copy">
              draft / offline definition 继续留在发布治理面板处理，不在这里伪装成已可调用 API。
            </p>
          </article>
        </div>
      </section>

      <div className="workflow-api-doc-list">
        {publishedBindings.map((binding) => {
          const doc = buildWorkflowApiBindingDoc(binding);

          return (
            <article
              className="workspace-panel workflow-api-doc-card"
              data-binding-id={binding.id}
              data-component="workflow-api-binding-doc"
              key={binding.id}
            >
              <div className="workflow-api-doc-header">
                <div>
                  <p className="workflow-studio-placeholder-eyebrow">Endpoint</p>
                  <h3>{doc.title}</h3>
                  <p>{doc.endpointSummary}</p>
                </div>
                <div className="workflow-api-chip-row">
                  {doc.protocolChips.map((chip) => (
                    <span className="event-chip" key={`${binding.id}-${chip}`}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="workspace-overview-strip workflow-api-meta-strip">
                <article className="workspace-stat-card">
                  <span>Protocol</span>
                  <strong>{doc.protocolLabel}</strong>
                </article>
                <article className="workspace-stat-card">
                  <span>Auth mode</span>
                  <strong>{doc.authModeLabel}</strong>
                </article>
                <article className="workspace-stat-card workspace-stat-card-wide">
                  <span>Base URL</span>
                  <strong>{doc.baseUrl}</strong>
                  <p className="workspace-stat-copy">Request path: {doc.requestPath}</p>
                </article>
              </div>

              <div className="workflow-api-doc-grid">
                <section className="workflow-api-section-card">
                  <h4>鉴权与接入说明</h4>
                  <p>{doc.authDescription}</p>
                  <dl className="workflow-api-meta-list">
                    <div>
                      <dt>Request URL</dt>
                      <dd>{doc.requestUrl}</dd>
                    </div>
                    <div>
                      <dt>Published alias</dt>
                      <dd>{binding.endpoint_alias}</dd>
                    </div>
                    <div>
                      <dt>Route path</dt>
                      <dd>{binding.route_path}</dd>
                    </div>
                    {doc.requestHeaders.length > 0 ? (
                      <div>
                        <dt>Required headers</dt>
                        <dd>{doc.requestHeaders.join(" · ")}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                <section className="workflow-api-section-card">
                  <h4>最小请求示例</h4>
                  <pre className="workflow-api-code-block">{doc.snippet}</pre>
                </section>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
