const WORKFLOW_PUBLISH_DRAFT_SECTION_ID = "workflow-editor-publish-section";
const WORKFLOW_PUBLISH_DRAFT_ENDPOINT_ID_PREFIX = "workflow-editor-publish-endpoint";

function slugifyWorkflowPublishDraftToken(value: string) {
  const normalized = value.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

  return slug || "draft-endpoint";
}

export function buildWorkflowPublishDraftSectionId() {
  return WORKFLOW_PUBLISH_DRAFT_SECTION_ID;
}

export function buildWorkflowPublishDraftSectionHref() {
  return `#${buildWorkflowPublishDraftSectionId()}`;
}

export function buildWorkflowPublishDraftEndpointId(endpointId: string) {
  return `${WORKFLOW_PUBLISH_DRAFT_ENDPOINT_ID_PREFIX}-${slugifyWorkflowPublishDraftToken(endpointId)}`;
}

export function buildWorkflowPublishDraftEndpointHref(endpointId: string) {
  return `#${buildWorkflowPublishDraftEndpointId(endpointId)}`;
}
