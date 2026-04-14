import { apiFetch } from './transport';

export interface PasswordSignInInput {
  identifier: string;
  password: string;
  authenticator?: string;
}

export interface PasswordSignInResponse {
  csrf_token: string;
  effective_display_role: string;
  current_workspace_id: string;
}

export function signInWithPassword(
  input: PasswordSignInInput,
  baseUrl?: string
): Promise<PasswordSignInResponse> {
  return apiFetch<PasswordSignInResponse>({
    path: '/api/public/auth/providers/password-local/sign-in',
    method: 'POST',
    body: input,
    baseUrl
  });
}
