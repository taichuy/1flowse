"use server";

import { revalidatePath } from "next/cache";

import { getApiBaseUrl } from "@/lib/api-base-url";

export type SyncAdapterToolsState = {
  status: "idle" | "success" | "error";
  message: string;
  syncedCount: number;
};

export async function syncAdapterTools(
  _: SyncAdapterToolsState,
  formData: FormData
): Promise<SyncAdapterToolsState> {
  const adapterId = String(formData.get("adapterId") ?? "").trim();
  if (!adapterId) {
    return {
      status: "error",
      message: "未提供 adapter 标识，无法同步工具目录。",
      syncedCount: 0
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/plugins/adapters/${encodeURIComponent(adapterId)}/sync-tools`,
      {
        method: "POST",
        cache: "no-store"
      }
    );
    const body = (await response.json().catch(() => null)) as
      | { discovered_count?: number; detail?: string }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? `工具目录同步失败，API 返回 ${response.status}。`,
        syncedCount: 0
      };
    }

    const syncedCount = body?.discovered_count ?? 0;
    revalidatePath("/");
    return {
      status: "success",
      message: `已从 ${adapterId} 同步 ${syncedCount} 个工具定义。`,
      syncedCount
    };
  } catch {
    return {
      status: "error",
      message: "无法连接后端同步工具目录，请确认 API 与 adapter 已启动。",
      syncedCount: 0
    };
  }
}
