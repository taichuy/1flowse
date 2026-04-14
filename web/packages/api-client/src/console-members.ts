import { apiFetch, apiFetchVoid } from './transport';

export interface ConsoleMember {
  id: string;
  account: string;
  email: string;
  phone: string | null;
  name: string;
  nickname: string;
  introduction: string;
  default_display_role: string | null;
  email_login_enabled: boolean;
  phone_login_enabled: boolean;
  status: 'active' | 'disabled';
  role_codes: string[];
}

export interface CreateConsoleMemberInput {
  account: string;
  email: string;
  phone: string | null;
  password: string;
  name: string;
  nickname: string;
  introduction: string;
  email_login_enabled: boolean;
  phone_login_enabled: boolean;
}

export interface ResetConsoleMemberPasswordInput {
  new_password: string;
}

export interface ReplaceConsoleMemberRolesInput {
  role_codes: string[];
}

export function listConsoleMembers(baseUrl?: string): Promise<ConsoleMember[]> {
  return apiFetch<ConsoleMember[]>({
    path: '/api/console/members',
    baseUrl
  });
}

export function createConsoleMember(
  input: CreateConsoleMemberInput,
  csrfToken: string,
  baseUrl?: string
): Promise<ConsoleMember> {
  return apiFetch<ConsoleMember>({
    path: '/api/console/members',
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function disableConsoleMember(
  memberId: string,
  csrfToken: string,
  baseUrl?: string
): Promise<void> {
  return apiFetchVoid({
    path: `/api/console/members/${memberId}/actions/disable`,
    method: 'POST',
    csrfToken,
    baseUrl
  });
}

export function resetConsoleMemberPassword(
  memberId: string,
  input: ResetConsoleMemberPasswordInput,
  csrfToken: string,
  baseUrl?: string
): Promise<void> {
  return apiFetchVoid({
    path: `/api/console/members/${memberId}/actions/reset-password`,
    method: 'POST',
    body: input,
    csrfToken,
    baseUrl
  });
}

export function replaceConsoleMemberRoles(
  memberId: string,
  input: ReplaceConsoleMemberRolesInput,
  csrfToken: string,
  baseUrl?: string
): Promise<void> {
  return apiFetchVoid({
    path: `/api/console/members/${memberId}/roles`,
    method: 'PUT',
    body: input,
    csrfToken,
    baseUrl
  });
}
