export interface HealthResponse {
  service: string;
  status: 'ok';
  version: string;
}

export async function fetchApiHealth(
  baseUrl = 'http://127.0.0.1:3000'
): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/health`);

  if (!response.ok) {
    throw new Error(`health request failed: ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
