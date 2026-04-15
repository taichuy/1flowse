export interface HealthResponse {
  service: string;
  status: 'ok';
  version: string;
}

export type AppRouteId =
  | 'home'
  | 'application-detail'
  | 'embedded-apps'
  | 'tools'
  | 'settings'
  | 'me'
  | 'sign-in';
