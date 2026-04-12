import type { BadgeStatus } from '../../../data/workspace-data';

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{label}</span>;
}
