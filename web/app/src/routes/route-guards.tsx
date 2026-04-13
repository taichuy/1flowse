import type { PropsWithChildren } from 'react';

export function RouteGuard({
  children,
  permissionKey
}: PropsWithChildren<{ permissionKey: string }>) {
  void permissionKey;

  return <>{children}</>;
}
