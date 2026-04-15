import {
  createConsoleApplication,
  getConsoleApplication,
  getDefaultApiBaseUrl,
  listConsoleApplications,
  type ApiBaseUrlLocation,
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

export function getApplicationsApiBaseUrl(
  locationLike: ApiBaseUrlLocation | undefined =
    typeof window !== 'undefined' ? window.location : undefined
): string {
  return import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBaseUrl(locationLike);
}

export function fetchApplications(): Promise<Application[]> {
  return listConsoleApplications(getApplicationsApiBaseUrl());
}

export function fetchApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  return getConsoleApplication(applicationId, getApplicationsApiBaseUrl());
}

export function createApplication(input: CreateApplicationInput, csrfToken: string) {
  return createConsoleApplication(input, csrfToken, getApplicationsApiBaseUrl());
}
