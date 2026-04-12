export interface HealthResponse {
  service: string;
  status: 'ok';
  version: string;
}

export interface ApiBaseUrlLocation {
  protocol?: string;
  hostname?: string;
}

export function getDefaultApiBaseUrl(
  locationLike: ApiBaseUrlLocation | undefined =
    typeof window !== 'undefined' ? window.location : undefined
): string {
  const protocol = locationLike?.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = locationLike?.hostname || '127.0.0.1';

  return `${protocol}//${hostname}:7800`;
}

export async function fetchApiHealth(
  baseUrl = getDefaultApiBaseUrl()
): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/health`);

  if (!response.ok) {
    throw new Error(`health request failed: ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
