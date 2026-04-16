import type { ConnectionLineComponentProps } from '@xyflow/react';

export function AgentFlowCustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY
}: ConnectionLineComponentProps) {
  return (
    <path
      className="agent-flow-custom-connection-line"
      d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
      fill="none"
      stroke="#8fb39a"
      strokeWidth={2}
      strokeDasharray="6 4"
    />
  );
}
