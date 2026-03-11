"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { getApiBaseUrl } from "@/lib/api-base-url";
import type { WorkspaceStarterTemplateItem } from "@/lib/get-workspace-starters";
import {
  WORKFLOW_BUSINESS_TRACKS,
  getWorkflowBusinessTrack,
  type WorkflowBusinessTrack
} from "@/lib/workflow-business-tracks";

type WorkspaceStarterLibraryProps = {
  initialTemplates: WorkspaceStarterTemplateItem[];
};

type TrackFilter = "all" | WorkflowBusinessTrack;

type WorkspaceStarterFormState = {
  name: string;
  description: string;
  businessTrack: WorkflowBusinessTrack;
  defaultWorkflowName: string;
  workflowFocus: string;
  recommendedNextStep: string;
  tagsText: string;
};

export function WorkspaceStarterLibrary({
  initialTemplates
}: WorkspaceStarterLibraryProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeTrack, setActiveTrack] = useState<TrackFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplates[0]?.id ?? null
  );
  const [formState, setFormState] = useState<WorkspaceStarterFormState | null>(
    initialTemplates[0] ? buildFormState(initialTemplates[0]) : null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"idle" | "success" | "error">("idle");
  const [isSaving, startSavingTransition] = useTransition();

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (activeTrack !== "all" && template.business_track !== activeTrack) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        template.name,
        template.description,
        template.default_workflow_name,
        template.workflow_focus,
        template.recommended_next_step,
        template.tags.join(" ")
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [activeTrack, searchQuery, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );
  const selectedTrackMeta = selectedTemplate
    ? getWorkflowBusinessTrack(selectedTemplate.business_track)
    : null;
  const hasPendingChanges =
    selectedTemplate !== null &&
    formState !== null &&
    JSON.stringify(buildUpdatePayload(formState)) ===
      JSON.stringify(buildUpdatePayload(buildFormState(selectedTemplate)))
      ? false
      : Boolean(selectedTemplate && formState);

  useEffect(() => {
    if (selectedTemplateId && templates.some((template) => template.id === selectedTemplateId)) {
      return;
    }

    setSelectedTemplateId(templates[0]?.id ?? null);
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!filteredTemplates.length) {
      return;
    }

    if (
      selectedTemplateId &&
      filteredTemplates.some((template) => template.id === selectedTemplateId)
    ) {
      return;
    }

    setSelectedTemplateId(filteredTemplates[0].id);
  }, [filteredTemplates, selectedTemplateId]);

  useEffect(() => {
    setFormState(selectedTemplate ? buildFormState(selectedTemplate) : null);
  }, [selectedTemplate]);

  const handleSave = () => {
    if (!selectedTemplate || !formState) {
      return;
    }

    startSavingTransition(async () => {
      setMessage("正在更新 workspace starter...");
      setMessageTone("idle");

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/workspace-starters/${encodeURIComponent(selectedTemplate.id)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(buildUpdatePayload(formState))
          }
        );
        const body = (await response.json().catch(() => null)) as
          | WorkspaceStarterTemplateItem
          | { detail?: string }
          | null;

        if (!response.ok || !body || !("id" in body)) {
          setMessage(body && "detail" in body ? body.detail ?? "更新失败。" : "更新失败。");
          setMessageTone("error");
          return;
        }

        setTemplates((current) =>
          current.map((template) => (template.id === body.id ? body : template))
        );
        setSelectedTemplateId(body.id);
        setMessage(`已更新 workspace starter：${body.name}。`);
        setMessageTone("success");
      } catch {
        setMessage("无法连接后端更新 workspace starter，请确认 API 已启动。");
        setMessageTone("error");
      }
    });
  };

  return (
    <main className="editor-shell">
      <section className="hero creation-hero">
        <div className="hero-copy">
          <p className="eyebrow">Workspace Starter Governance</p>
          <h1>把模板从“能保存”推进到“能治理”</h1>
          <p className="hero-text">
            这条链路专门承接 editor 保存出来的 workspace starter，让团队能按业务主线查看、
            筛选、校对和更新模板元数据，而不是继续把模板治理留在编辑器里的单个按钮。
          </p>
          <div className="pill-row">
            <span className="pill">{templates.length} workspace starters</span>
            <span className="pill">{filteredTemplates.length} visible templates</span>
            <span className="pill">{WORKFLOW_BUSINESS_TRACKS.length} business tracks</span>
          </div>
          <div className="hero-actions">
            <Link className="inline-link" href="/workflows/new">
              返回创建页
            </Link>
            <Link className="inline-link secondary" href="/">
              返回系统首页
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-label">Governance state</div>
          <div className="panel-value">{templates.length > 0 ? "Ready" : "Empty"}</div>
          <p className="panel-text">
            当前主线：<strong>P0 应用新建编排</strong>
          </p>
          <p className="panel-text">
            视图能力：<strong>列表 / 筛选 / 详情 / 更新</strong>
          </p>
          <p className="panel-text">
            当前选中：<strong>{selectedTemplate?.name ?? "暂无模板"}</strong>
          </p>
          <dl className="signal-list">
            <div>
              <dt>Templates</dt>
              <dd>{templates.length}</dd>
            </div>
            <div>
              <dt>Filtered</dt>
              <dd>{filteredTemplates.length}</dd>
            </div>
            <div>
              <dt>Track</dt>
              <dd>
                {activeTrack === "all" ? "All" : getWorkflowBusinessTrack(activeTrack).priority}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="governance-layout">
        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h2>Template list</h2>
            </div>
            <p className="section-copy">
              先按主业务线和关键字收敛范围，再进入具体模板详情，避免 workspace starter
              library 只停留在“知道它存在”。
            </p>
          </div>

          <div className="starter-track-bar" role="tablist" aria-label="Workspace starter tracks">
            <button
              className={`starter-track-chip ${activeTrack === "all" ? "selected" : ""}`}
              type="button"
              onClick={() => setActiveTrack("all")}
            >
              <span>All</span>
              <strong>全部主线</strong>
              <small>{templates.length} starters</small>
            </button>
            {WORKFLOW_BUSINESS_TRACKS.map((track) => (
              <button
                key={track.id}
                className={`starter-track-chip ${activeTrack === track.id ? "selected" : ""}`}
                type="button"
                onClick={() => setActiveTrack(track.id)}
              >
                <span>{track.priority}</span>
                <strong>{track.id}</strong>
                <small>
                  {
                    templates.filter((template) => template.business_track === track.id).length
                  }{" "}
                  starters
                </small>
              </button>
            ))}
          </div>

          <div className="binding-form governance-filter-form">
            <label className="binding-field">
              <span className="binding-label">Search templates</span>
              <input
                className="trace-text-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="按名称、描述、焦点或标签筛选"
              />
            </label>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="empty-state-block">
              <p className="empty-state">
                当前筛选条件下还没有 workspace starter。可以先回到创建页新建 workflow，
                再从 editor 保存一个模板进入治理库。
              </p>
              <Link className="inline-link" href="/workflows/new">
                去创建第一个 starter
              </Link>
            </div>
          ) : (
            <div className="starter-grid">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  className={`starter-card ${template.id === selectedTemplateId ? "selected" : ""}`}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div className="starter-card-header">
                    <span className="starter-track">{template.business_track}</span>
                    <span className="health-pill">
                      {getWorkflowBusinessTrack(template.business_track).priority}
                    </span>
                  </div>
                  <strong>{template.name}</strong>
                  <p>{template.description || "暂未填写描述。"}</p>
                  <p className="starter-focus-copy">
                    {template.workflow_focus || "暂未填写 workflow focus。"}
                  </p>
                  <div className="starter-meta-row">
                    <span>{template.definition.nodes?.length ?? 0} nodes</span>
                    <span>{template.tags.length} tags</span>
                    <span>{formatTimestamp(template.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>

        <div className="governance-sidebar">
          <article className="diagnostic-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Detail</p>
                <h2>Starter metadata</h2>
              </div>
            </div>

            {!selectedTemplate || !formState ? (
              <p className="empty-state">选中一个模板后，这里会显示可更新的元数据与来源信息。</p>
            ) : (
              <>
                <div className="summary-strip compact-strip">
                  <div className="summary-card">
                    <span>Priority</span>
                    <strong>{selectedTrackMeta?.priority ?? "-"}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Nodes</span>
                    <strong>{selectedTemplate.definition.nodes?.length ?? 0}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Edges</span>
                    <strong>{selectedTemplate.definition.edges?.length ?? 0}</strong>
                  </div>
                </div>

                <div className="binding-form">
                  <label className="binding-field">
                    <span className="binding-label">Template name</span>
                    <input
                      className="trace-text-input"
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((current) =>
                          current ? { ...current, name: event.target.value } : current
                        )
                      }
                    />
                  </label>

                  <label className="binding-field">
                    <span className="binding-label">Business track</span>
                    <select
                      className="binding-select"
                      value={formState.businessTrack}
                      onChange={(event) =>
                        setFormState((current) =>
                          current
                            ? {
                                ...current,
                                businessTrack: event.target.value as WorkflowBusinessTrack
                              }
                            : current
                        )
                      }
                    >
                      {WORKFLOW_BUSINESS_TRACKS.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.priority} · {track.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="binding-field">
                    <span className="binding-label">Default workflow name</span>
                    <input
                      className="trace-text-input"
                      value={formState.defaultWorkflowName}
                      onChange={(event) =>
                        setFormState((current) =>
                          current
                            ? { ...current, defaultWorkflowName: event.target.value }
                            : current
                        )
                      }
                    />
                  </label>

                  <label className="binding-field">
                    <span className="binding-label">Description</span>
                    <textarea
                      className="governance-textarea"
                      value={formState.description}
                      onChange={(event) =>
                        setFormState((current) =>
                          current ? { ...current, description: event.target.value } : current
                        )
                      }
                    />
                  </label>

                  <label className="binding-field">
                    <span className="binding-label">Workflow focus</span>
                    <textarea
                      className="governance-textarea"
                      value={formState.workflowFocus}
                      onChange={(event) =>
                        setFormState((current) =>
                          current ? { ...current, workflowFocus: event.target.value } : current
                        )
                      }
                    />
                  </label>

                  <label className="binding-field">
                    <span className="binding-label">Recommended next step</span>
                    <textarea
                      className="governance-textarea"
                      value={formState.recommendedNextStep}
                      onChange={(event) =>
                        setFormState((current) =>
                          current
                            ? { ...current, recommendedNextStep: event.target.value }
                            : current
                        )
                      }
                    />
                  </label>

                  <label className="binding-field">
                    <span className="binding-label">Tags</span>
                    <input
                      className="trace-text-input"
                      value={formState.tagsText}
                      onChange={(event) =>
                        setFormState((current) =>
                          current ? { ...current, tagsText: event.target.value } : current
                        )
                      }
                      placeholder="使用逗号分隔标签"
                    />
                  </label>

                  <div className="binding-actions">
                    <button
                      className="sync-button"
                      type="button"
                      onClick={handleSave}
                      disabled={!hasPendingChanges || isSaving}
                    >
                      {isSaving ? "保存中..." : "保存元数据"}
                    </button>
                    {selectedTemplate.created_from_workflow_id ? (
                      <Link
                        className="inline-link secondary"
                        href={`/workflows/${encodeURIComponent(selectedTemplate.created_from_workflow_id)}`}
                      >
                        打开源 workflow
                      </Link>
                    ) : null}
                  </div>

                  <p className={`sync-message ${messageTone}`}>
                    {message ??
                      "更新后会直接写回 workspace starter library，创建页会立刻复用最新元数据。"}
                  </p>
                </div>
              </>
            )}
          </article>

          <article className="diagnostic-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>Definition snapshot</h2>
              </div>
            </div>

            {!selectedTemplate ? (
              <p className="empty-state">当前没有可预览的模板定义。</p>
            ) : (
              <>
                <div className="meta-grid">
                  <div className="summary-card">
                    <span>Updated</span>
                    <strong>{formatTimestamp(selectedTemplate.updated_at)}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Workflow version</span>
                    <strong>{selectedTemplate.created_from_workflow_version ?? "n/a"}</strong>
                  </div>
                </div>

                <div className="starter-tag-row">
                  {selectedTemplate.tags.map((tag) => (
                    <span className="event-chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="governance-node-list">
                  {(selectedTemplate.definition.nodes ?? []).map((node) => (
                    <div className="binding-card compact-card" key={node.id}>
                      <div className="binding-card-header">
                        <div>
                          <p className="entry-card-title">{node.name ?? node.id}</p>
                          <p className="binding-meta">
                            {node.type} · {node.id}
                          </p>
                        </div>
                        <span className="health-pill">{node.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

function buildFormState(template: WorkspaceStarterTemplateItem): WorkspaceStarterFormState {
  return {
    name: template.name,
    description: template.description,
    businessTrack: template.business_track,
    defaultWorkflowName: template.default_workflow_name,
    workflowFocus: template.workflow_focus,
    recommendedNextStep: template.recommended_next_step,
    tagsText: template.tags.join(", ")
  };
}

function buildUpdatePayload(formState: WorkspaceStarterFormState) {
  return {
    name: formState.name.trim(),
    description: formState.description.trim(),
    business_track: formState.businessTrack,
    default_workflow_name: formState.defaultWorkflowName.trim(),
    workflow_focus: formState.workflowFocus.trim(),
    recommended_next_step: formState.recommendedNextStep.trim(),
    tags: formState.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
