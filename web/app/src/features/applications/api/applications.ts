import {
  createConsoleApplication,
  getConsoleApplication,
  listConsoleApplications,
  type ConsoleApplicationDetail,
  type ConsoleApplicationSummary,
  type CreateConsoleApplicationInput
} from '@1flowse/api-client';

export type Application = ConsoleApplicationSummary;
export type ApplicationDetail = ConsoleApplicationDetail;
export type CreateApplicationInput = CreateConsoleApplicationInput;

export const applicationsQueryKey = ['applications'] as const;
export const applicationDetailQueryKey = (applicationId: string) =>
  ['applications', applicationId] as const;

export function fetchApplications(): Promise<Application[]> {
  return listConsoleApplications();
}

export function fetchApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  return getConsoleApplication(applicationId);
}

export function createApplication(input: CreateApplicationInput, csrfToken: string) {
  return createConsoleApplication(input, csrfToken);
}
