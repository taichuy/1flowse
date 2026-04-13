import type { PropsWithChildren } from 'react';

import type { DemoStatus } from '../../features/demo-data';

interface StatusPillProps extends PropsWithChildren {
  status: DemoStatus;
  tone?: 'default' | 'caps';
}

export function StatusPill({
  status,
  tone = 'default',
  children
}: StatusPillProps) {
  return (
    <span className={`status-pill ${status} ${tone === 'caps' ? 'is-caps' : ''}`}>
      {children}
    </span>
  );
}
