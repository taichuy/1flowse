export function formatTimestamp(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false
  }).format(new Date(value));
}

export function formatCountMap(value: Record<string, number>) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([label, count]) => `${label}:${count}`).join(" / ");
}

export function formatJsonPayload(value: unknown) {
  const serialized = JSON.stringify(value ?? null, null, 2);
  return serialized ?? String(value);
}

export function formatDuration(
  startedAt?: string | null,
  finishedAt?: string | null
) {
  if (!startedAt) {
    return "not-started";
  }

  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const durationMs = Math.max(0, end - start);

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  if (durationMs < 60_000) {
    const seconds = durationMs / 1000;
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatKeyList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}
