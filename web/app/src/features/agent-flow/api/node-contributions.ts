import {
  listConsoleNodeContributions,
  type ConsoleNodeContributionEntry
} from '@1flowbase/api-client';

import { getApplicationsApiBaseUrl } from '../../applications/api/applications';

export type AgentFlowNodeContributionEntry = ConsoleNodeContributionEntry;

export const nodeContributionsQueryKey = (applicationId: string) =>
  ['applications', applicationId, 'node-contributions'] as const;

export function fetchNodeContributions(applicationId: string) {
  return listConsoleNodeContributions(
    applicationId,
    getApplicationsApiBaseUrl()
  );
}
