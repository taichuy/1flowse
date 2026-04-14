import {
  deleteConsoleSession as requestDeleteConsoleSession,
  fetchConsoleMe as requestFetchConsoleMe,
  fetchConsoleSession as requestFetchConsoleSession,
  getDefaultApiBaseUrl,
  signInWithPassword as requestSignInWithPassword,
  type ApiBaseUrlLocation,
  type ConsoleMe,
  type ConsoleSessionSnapshot,
  type PasswordSignInInput,
  type PasswordSignInResponse
} from '@1flowse/api-client';

export function getAuthApiBaseUrl(
  locationLike: ApiBaseUrlLocation | undefined =
    typeof window !== 'undefined' ? window.location : undefined
): string {
  return import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBaseUrl(locationLike);
}

export function signInWithPassword(
  input: PasswordSignInInput,
  baseUrl = getAuthApiBaseUrl()
): Promise<PasswordSignInResponse> {
  return requestSignInWithPassword(input, baseUrl);
}

export function fetchCurrentSession(
  baseUrl = getAuthApiBaseUrl()
): Promise<ConsoleSessionSnapshot> {
  return requestFetchConsoleSession(baseUrl);
}

export function fetchCurrentMe(baseUrl = getAuthApiBaseUrl()): Promise<ConsoleMe> {
  return requestFetchConsoleMe(baseUrl);
}

export function signOut(
  csrfToken: string,
  baseUrl = getAuthApiBaseUrl()
): Promise<void> {
  return requestDeleteConsoleSession(csrfToken, baseUrl);
}
