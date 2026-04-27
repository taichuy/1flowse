import type { RuntimeDebugStreamPart } from '@1flowbase/api-client';

export interface RuntimeDebugStreamViewPart {
  id: string;
  type: string;
  status: string;
  trustLevel: string;
  isHostFact: boolean;
  text?: string;
  payload: unknown;
}

function readText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const nested = (payload as { payload?: unknown }).payload;
  if (!nested || typeof nested !== 'object') {
    return undefined;
  }

  const value =
    (nested as { delta?: unknown; text?: unknown }).delta ??
    (nested as { delta?: unknown; text?: unknown }).text;

  return typeof value === 'string' ? value : undefined;
}

export function mapRuntimeDebugStreamParts(
  parts: RuntimeDebugStreamPart[]
): RuntimeDebugStreamViewPart[] {
  return parts.map((part) => ({
    id: part.id,
    type: part.part_type,
    status: part.status,
    trustLevel: part.trust_level,
    isHostFact: part.trust_level === 'host_fact',
    text: readText(part.payload),
    payload: part.payload
  }));
}
