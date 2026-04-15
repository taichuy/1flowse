import { apiFetch } from './transport';

export type ConsoleApplicationType = 'agent_flow' | 'workflow';

export interface ConsoleApplicationSummary {
  id: string;
  application_type: ConsoleApplicationType;
  name: string;
  description: string;
  icon: string | null;
  icon_type: string | null;
  icon_background: string | null;
  updated_at: string;
}

export interface ConsoleApplicationSections {
  orchestration: {
    status: string;
    subject_kind: string;
    subject_status: string;
    current_subject_id: string | null;
    current_draft_id: string | null;
  };
  api: {
    status: string;
    credential_kind: string;
    invoke_routing_mode: string;
    invoke_path_template: string | null;
    api_capability_status: string;
    credentials_status: string;
  };
  logs: {
    status: string;
    runs_capability_status: string;
    run_object_kind: string;
    log_retention_status: string;
  };
  monitoring: {
    status: string;
    metrics_capability_status: string;
    metrics_object_kind: string;
    tracing_config_status: string;
  };
}

export interface ConsoleApplicationDetail extends ConsoleApplicationSummary {
  sections: ConsoleApplicationSections;
}

export interface CreateConsoleApplicationInput {
  application_type: ConsoleApplicationType;
  name: string;
  description: string;
  icon: string | null;
  icon_type: string | null;
  icon_background: string | null;
}

export function listConsoleApplications(baseUrl?: string): Promise<ConsoleApplicationSummary[]> {
  return apiFetch<ConsoleApplicationSummary[]>({
    path: '/api/console/applications',
    baseUrl
  });
}

export function createConsoleApplication(
  input: CreateConsoleApplicationInput,
  csrfToken: string,
  baseUrl?: string
): Promise<ConsoleApplicationDetail> {
  return apiFetch<ConsoleApplicationDetail>({
    path: '/api/console/applications',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function getConsoleApplication(
  applicationId: string,
  baseUrl?: string
): Promise<ConsoleApplicationDetail> {
  return apiFetch<ConsoleApplicationDetail>({
    path: `/api/console/applications/${applicationId}`,
    baseUrl
  });
}
