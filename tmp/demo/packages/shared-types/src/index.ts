export interface HealthResponse {
  service: string;
  status: 'ok';
  version: string;
}

export type AppRouteId = 'home' | 'agent-flow';
