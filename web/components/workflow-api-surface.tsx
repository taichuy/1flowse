import React from "react";
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
  const docs = publishedBindings.map((binding) => buildWorkflowApiBindingDoc(binding));

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
              当前页面直接消费 workflow 已发布 binding 的真实 contract：围绕 base URL、鉴权、
              endpoint 入口、最小请求示例与协议差异组织成文档页，避免再从 publish 表单或外部记忆倒推调用方式。
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

      <div className="workflow-api-layout">
        <div className="workflow-api-doc-list">
          {docs.map((doc) => (
            <article
              className="workspace-panel workflow-api-doc-card"
              data-binding-id={doc.bindingId}
              data-component="workflow-api-binding-doc"
              id={doc.anchorId}
              key={doc.bindingId}
            >
              <div className="workflow-api-doc-header">
                <div>
                  <p className="workflow-studio-placeholder-eyebrow">Endpoint</p>
                  <h3>{doc.title}</h3>
                  <p>{doc.endpointSummary}</p>
                </div>
                <div className="workflow-api-chip-row">
                  {doc.protocolChips.map((chip) => (
                    <span className="event-chip" key={`${doc.bindingId}-${chip}`}>
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
                {doc.sections.map((section) => (
                  <section
                    className="workflow-api-section-card"
                    data-component="workflow-api-doc-section"
                    data-section-id={section.id}
                    id={section.id}
                    key={section.id}
                  >
                    <div className="workflow-api-section-heading">
                      <p className="workflow-studio-placeholder-eyebrow">{section.eyebrow}</p>
                      <h4>{section.title}</h4>
                    </div>

                    <p className="section-copy">{section.description}</p>

                    {section.metaRows?.length ? (
                      <dl className="workflow-api-meta-list">
                        {section.metaRows.map((row) => (
                          <div key={`${section.id}-${row.label}`}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    {section.bulletItems?.length ? (
                      <ul className="workflow-api-bullet-list">
                        {section.bulletItems.map((item) => (
                          <li key={`${section.id}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    ) : null}

                    {section.codeBlock ? (
                      <div className="workflow-api-code-card">
                        <div className="workflow-api-code-header">{section.codeLabel ?? "Code"}</div>
                        <pre className="workflow-api-code-block">{section.codeBlock}</pre>
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="workspace-panel workflow-api-directory" data-component="workflow-api-directory">
          <div className="workflow-api-directory-header">
            <p className="workflow-studio-placeholder-eyebrow">目录</p>
            <h3>Published API docs</h3>
            <p>
              先按 binding 锁定协议，再跳到基础 URL、鉴权、endpoint、请求示例和协议差异章节。
            </p>
          </div>

          <nav aria-label="Workflow API 目录" className="workflow-api-directory-nav">
            {docs.map((doc) => (
              <div
                className="workflow-api-directory-group"
                data-component="workflow-api-directory-group"
                key={doc.bindingId}
              >
                <a className="workflow-api-directory-binding" href={`#${doc.anchorId}`}>
                  <span>{doc.title}</span>
                  <small>{doc.directorySummary}</small>
                </a>

                <div className="workflow-api-directory-links">
                  {doc.sections.map((section) => (
                    <a className="workflow-api-directory-link" href={`#${section.id}`} key={section.id}>
                      {section.navLabel}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
