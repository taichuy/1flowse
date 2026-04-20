import { apiFetch } from './transport';

export interface ConsoleNodeContributionEntry {
  installation_id: string;
  provider_code: string;
  plugin_id: string;
  plugin_version: string;
  contribution_code: string;
  node_shell: string;
  category: string;
  title: string;
  description: string;
  dependency_status: string;
  schema_version: string;
  experimental: boolean;
  icon: string;
  schema_ui: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  required_auth: string[];
  visibility: string;
  dependency_installation_kind: string;
  dependency_plugin_version_range: string;
}

function buildNodeContributionsPath(applicationId: string) {
  const params = new URLSearchParams({
    application_id: applicationId
  });
  return `/api/console/node-contributions?${params.toString()}`;
}

export function listConsoleNodeContributions(
  applicationId: string,
  baseUrl?: string
) {
  return apiFetch<ConsoleNodeContributionEntry[]>({
    path: buildNodeContributionsPath(applicationId),
    baseUrl
  });
}
