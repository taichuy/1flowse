import type { PluginAdapterRegistryItem } from "@/lib/get-plugin-registry";

export function describePluginAdapterMode(mode: PluginAdapterRegistryItem["mode"]) {
  if (mode === "proxy") {
    return "当前 adapter 会把翻译后的 invoke payload 继续代理到 Dify plugin daemon，并把结果聚合回 7Flows tool runtime。";
  }

  if (mode === "translate") {
    return "当前 adapter 只做受约束 contract 校验与 payload 翻译；目录同步会调用 adapter 的 /tools，并把结果写入 API 持久化目录。";
  }

  return "目录同步会调用 adapter 的 /tools，并把返回结果写入 API 持久化目录。";
}

export function describePluginAdapterHealth(adapter: PluginAdapterRegistryItem) {
  return normalizeText(adapter.detail) ?? describePluginAdapterMode(adapter.mode);
}

export function formatPluginAdapterDescriptor(adapter: PluginAdapterRegistryItem) {
  const badges = [`status ${adapter.status}`];
  if (adapter.mode) {
    badges.push(`mode ${adapter.mode}`);
  }
  if (!adapter.enabled) {
    badges.push("disabled");
  }

  const headline = `${adapter.id} (${badges.join(", ")})`;
  const detail = describePluginAdapterHealth(adapter);
  return detail ? `${headline}: ${detail}` : headline;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}
