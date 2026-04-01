"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getApiBaseUrl } from "@/lib/api-base-url";
import {
  buildWorkflowPublishApiKeyMutationFallbackErrorMessage,
  buildWorkflowPublishApiKeyMutationNetworkErrorMessage,
  buildWorkflowPublishApiKeyMutationSuccessMessage,
  buildWorkflowPublishApiKeyMutationValidationMessage,
  buildWorkflowPublishLifecycleMutationFallbackErrorMessage,
  buildWorkflowPublishLifecycleMutationNetworkErrorMessage,
  buildWorkflowPublishLifecycleMutationSuccessMessage,
  buildWorkflowPublishLifecycleMutationValidationMessage
} from "@/lib/workflow-publish-binding-presenters";
import type {
  PublishedEndpointInvocationListResponse,
  WorkflowPublishedEndpointLegacyAuthCleanupResult
} from "@/lib/get-workflow-publish";
import {
  buildWorkflowPublishLegacyAuthCleanupFallbackErrorMessage,
  buildWorkflowPublishLegacyAuthCleanupNetworkErrorMessage,
  buildWorkflowPublishLegacyAuthCleanupSuccessMessage,
  buildWorkflowPublishLegacyAuthCleanupValidationMessage,
} from "@/lib/workflow-publish-legacy-auth-cleanup";
import {
  buildWorkflowApiRequestSurface,
  buildWorkflowApiSampleBlockedMessage,
  buildWorkflowApiSampleResultHref,
  type WorkflowApiSampleInvocationQueryScope
} from "@/lib/workflow-api-surface";
import {
  getServerWorkflowPublishedEndpoints
} from "@/lib/server-workspace-access";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  buildCookieHeader
} from "@/lib/workspace-access";
import {
  buildWorkflowDetailHref,
  buildWorkflowStudioSurfaceHref
} from "@/lib/workbench-links";


function revalidateWorkflowStudioPaths(workflowId: string) {
  revalidatePath(buildWorkflowDetailHref(workflowId));
  revalidatePath(buildWorkflowStudioSurfaceHref(workflowId, "editor"));
  revalidatePath(buildWorkflowStudioSurfaceHref(workflowId, "publish"));
}

export type UpdatePublishedEndpointLifecycleState = {
  status: "idle" | "success" | "error";
  message: string;
  workflowId: string;
  bindingId: string;
  nextStatus: "published" | "offline";
};

export type CreatePublishedEndpointApiKeyState = {
  status: "idle" | "success" | "error";
  message: string;
  workflowId: string;
  bindingId: string;
  name: string;
  secretKey: string | null;
  keyPrefix: string | null;
};

export type RevokePublishedEndpointApiKeyState = {
  status: "idle" | "success" | "error";
  message: string;
  workflowId: string;
  bindingId: string;
  keyId: string;
};

export type CleanupLegacyPublishedEndpointBindingsState = {
  status: "idle" | "success" | "error";
  message: string;
  workflowId: string;
  bindingIds: string[];
};

type CreatedPublishedEndpointApiKey = {
  id: string;
  name?: string;
  key_prefix?: string;
  secret_key?: string;
};


type PublishedEndpointGatewayErrorBody = {
  detail?:
    | string
    | {
        message?: string;
        reason_code?: string;
        run_id?: string;
        run_status?: string;
        run?: { id?: string; status?: string } | null;
      };
  message?: string;
  run?: { id?: string; status?: string } | null;
};

function buildWorkflowApiSurfaceRedirectHref(workflowId: string, requestedHref: string) {
  const normalizedRequestedHref = requestedHref.trim();
  if (normalizedRequestedHref) {
    return normalizedRequestedHref;
  }
  return workflowId.trim() ? buildWorkflowStudioSurfaceHref(workflowId, "api") : "/workflows";
}

function truncateWorkflowApiSampleMessage(message: string, limit = 220) {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return "";
  }
  return normalizedMessage.length > limit
    ? `${normalizedMessage.slice(0, limit - 1).trimEnd()}…`
    : normalizedMessage;
}

function createWorkflowApiSampleMessage(message: string, fallback: string) {
  const normalizedMessage = truncateWorkflowApiSampleMessage(message);
  return normalizedMessage || fallback;
}

function buildWorkflowApiSampleQueryScope(
  queryScope: Partial<WorkflowApiSampleInvocationQueryScope> & {
    status: "success" | "error";
    bindingId: string;
  }
): WorkflowApiSampleInvocationQueryScope {
  return {
    status: queryScope.status,
    bindingId: queryScope.bindingId,
    invocationId: queryScope.invocationId ?? null,
    runId: queryScope.runId ?? null,
    runStatus: queryScope.runStatus ?? null,
    message: queryScope.message ?? null,
    requestSurface: queryScope.requestSurface ?? null,
    cleanup: queryScope.cleanup ?? null
  };
}

async function createTemporaryPublishedEndpointApiKey(
  workflowId: string,
  bindingId: string,
  name: string
): Promise<CreatedPublishedEndpointApiKey | null> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/workflows/${encodeURIComponent(
        workflowId
      )}/published-endpoints/${encodeURIComponent(bindingId)}/api-keys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name }),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json().catch(() => null)) as CreatedPublishedEndpointApiKey | null;
  } catch {
    return null;
  }
}

async function revokeTemporaryPublishedEndpointApiKey(
  workflowId: string,
  bindingId: string,
  keyId: string
) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/workflows/${encodeURIComponent(
        workflowId
      )}/published-endpoints/${encodeURIComponent(bindingId)}/api-keys/${encodeURIComponent(keyId)}`,
      {
        method: "DELETE",
        cache: "no-store"
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

async function fetchWorkspaceJson<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieEntries = cookieStore.getAll().map((item) => ({
    name: item.name,
    value: item.value
  }));
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ?? "";
  const headers = new Headers();
  const cookieHeader = buildCookieHeader(cookieEntries);

  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      headers
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function getFreshSampleInvocation(
  workflowId: string,
  bindingId: string,
  apiKeyId: string,
  runId: string | null
) {
  const searchParams = new URLSearchParams({
    limit: "5",
    api_key_id: apiKeyId
  });
  const response = await fetchWorkspaceJson<PublishedEndpointInvocationListResponse>(
    `/api/workflows/${encodeURIComponent(
      workflowId
    )}/published-endpoints/${encodeURIComponent(bindingId)}/invocations?${searchParams.toString()}`
  );
  const items = response?.items ?? [];

  return (
    items.find((item) => item.run_id === runId) ??
    items[0] ??
    null
  );
}

function resolvePublishedGatewayBodyMessage(body: PublishedEndpointGatewayErrorBody | null) {
  const detail = body?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (detail && typeof detail.message === "string") {
    return detail.message;
  }
  if (typeof body?.message === "string") {
    return body.message;
  }
  return null;
}

function resolvePublishedGatewayBodyRunId(body: PublishedEndpointGatewayErrorBody | null) {
  const detail = body?.detail;
  if (detail && typeof detail !== "string") {
    if (detail.run?.id?.trim()) {
      return detail.run.id.trim();
    }
    if (detail.run_id?.trim()) {
      return detail.run_id.trim();
    }
  }
  if (body?.run?.id?.trim()) {
    return body.run.id.trim();
  }
  return null;
}

function resolvePublishedGatewayBodyRunStatus(body: PublishedEndpointGatewayErrorBody | null) {
  const detail = body?.detail;
  if (detail && typeof detail !== "string") {
    if (detail.run?.status?.trim()) {
      return detail.run.status.trim();
    }
    if (detail.run_status?.trim()) {
      return detail.run_status.trim();
    }
  }
  if (body?.run?.status?.trim()) {
    return body.run.status.trim();
  }
  return null;
}

export async function invokePublishedEndpointSample(formData: FormData): Promise<never> {
  const workflowId = String(formData.get("workflowId") ?? "").trim();
  const bindingId = String(formData.get("bindingId") ?? "").trim();
  const apiHref = buildWorkflowApiSurfaceRedirectHref(
    workflowId,
    String(formData.get("apiHref") ?? "")
  );

  if (!workflowId || !bindingId) {
    redirect(
      buildWorkflowApiSampleResultHref(apiHref, {
        status: "error",
        bindingId: bindingId || "missing-binding",
        message: "缺少 workflow 或 published binding 标识，sample invocation 已停止。"
      })
    );
  }

  const bindings = await getServerWorkflowPublishedEndpoints(workflowId, {
    includeAllVersions: true
  });
  const binding = bindings.find((item) => item.id === bindingId) ?? null;

  if (!binding) {
    redirect(
      buildWorkflowApiSampleResultHref(apiHref, {
        status: "error",
        bindingId,
        message: "当前 workflow 没有找到对应的 published binding，sample invocation 已停止。"
      })
    );
  }

  const blockedMessage = buildWorkflowApiSampleBlockedMessage(binding);
  if (blockedMessage) {
    redirect(
      buildWorkflowApiSampleResultHref(apiHref, {
        status: "error",
        bindingId,
        message: blockedMessage
      })
    );
  }

  const temporaryKeyName = `Workflow API sample ${new Date().toISOString()}`.slice(0, 96);
  const createdKey = await createTemporaryPublishedEndpointApiKey(
    workflowId,
    bindingId,
    temporaryKeyName
  );

  if (!createdKey?.id || !createdKey.secret_key) {
    redirect(
      buildWorkflowApiSampleResultHref(apiHref, {
        status: "error",
        bindingId,
        message:
          "当前 binding 没能创建临时 published API key，sample invocation 已 fail-closed。请先去发布治理确认 key management。"
      })
    );
  }

  const sampleRequest = buildWorkflowApiRequestSurface(binding, {
    apiKey: createdKey.secret_key
  });
  let resultQueryScope = buildWorkflowApiSampleQueryScope({
    status: "error",
    bindingId,
    requestSurface: sampleRequest.requestSurface,
    message: "sample invocation 未完成。"
  });

  try {
    const invokeResponse = await fetch(sampleRequest.requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          sampleRequest.requestHeaderEntries.map((entry) => [entry.name, entry.value])
        )
      },
      body: JSON.stringify(sampleRequest.requestBody),
      cache: "no-store"
    });
    const body = (await invokeResponse.json().catch(() => null)) as PublishedEndpointGatewayErrorBody | null;
    const responseRunId =
      invokeResponse.headers.get("x-7flows-run-id")?.trim() ||
      resolvePublishedGatewayBodyRunId(body);
    const responseRunStatus =
      invokeResponse.headers.get("x-7flows-run-status")?.trim().toLowerCase() ||
      resolvePublishedGatewayBodyRunStatus(body)?.toLowerCase() ||
      null;
    const freshInvocation = await getFreshSampleInvocation(
      workflowId,
      bindingId,
      createdKey.id,
      responseRunId ?? null
    );
    const runId = responseRunId ?? freshInvocation?.run_id ?? null;
    const runStatus = responseRunStatus ?? freshInvocation?.run_status ?? null;
    const baseMessage = invokeResponse.ok
      ? "已通过临时 published API key 触发一次本地 sample invocation，并把 handoff 锁定到最新 published invocation / run。"
      : resolvePublishedGatewayBodyMessage(body) ??
        "published gateway 没有返回成功结果，sample invocation 已保留真实失败事实。";

    resultQueryScope = buildWorkflowApiSampleQueryScope({
      status: invokeResponse.ok ? "success" : "error",
      bindingId,
      invocationId: freshInvocation?.id ?? null,
      runId,
      runStatus,
      requestSurface: freshInvocation?.request_surface ?? sampleRequest.requestSurface,
      message: createWorkflowApiSampleMessage(
        baseMessage,
        invokeResponse.ok
          ? "sample invocation 已完成。"
          : "sample invocation 已返回错误。"
      )
    });
  } catch {
    resultQueryScope = buildWorkflowApiSampleQueryScope({
      status: "error",
      bindingId,
      requestSurface: sampleRequest.requestSurface,
      message: "sample invocation 请求失败，请确认本地 API / published gateway 可用。"
    });
  }

  const revokeSucceeded = await revokeTemporaryPublishedEndpointApiKey(
    workflowId,
    bindingId,
    createdKey.id
  );
  if (!revokeSucceeded) {
    resultQueryScope = {
      ...resultQueryScope,
      cleanup: "revoke_failed",
      message: createWorkflowApiSampleMessage(
        `${resultQueryScope.message ?? "sample invocation 已完成。"} 但临时 published API key 自动吊销失败，请立即前往发布治理处理。`,
        "临时 published API key 自动吊销失败，请立即前往发布治理处理。"
      )
    };
  } else {
    resultQueryScope = {
      ...resultQueryScope,
      cleanup: "clean"
    };
  }

  redirect(buildWorkflowApiSampleResultHref(apiHref, resultQueryScope));
}

export async function updatePublishedEndpointLifecycle(
  _: UpdatePublishedEndpointLifecycleState,
  formData: FormData
): Promise<UpdatePublishedEndpointLifecycleState> {
  const workflowId = String(formData.get("workflowId") ?? "").trim();
  const bindingId = String(formData.get("bindingId") ?? "").trim();
  const nextStatus = String(formData.get("nextStatus") ?? "").trim();

  if (
    !workflowId ||
    !bindingId ||
    (nextStatus !== "published" && nextStatus !== "offline")
  ) {
    return {
      status: "error",
      message: buildWorkflowPublishLifecycleMutationValidationMessage(),
      workflowId,
      bindingId,
      nextStatus: nextStatus === "offline" ? "offline" : "published"
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/workflows/${encodeURIComponent(
        workflowId
      )}/published-endpoints/${encodeURIComponent(bindingId)}/lifecycle`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: nextStatus
        }),
        cache: "no-store"
      }
    );

    const body = (await response.json().catch(() => null)) as
      | { detail?: string; endpoint_name?: string; lifecycle_status?: string }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? buildWorkflowPublishLifecycleMutationFallbackErrorMessage(nextStatus),
        workflowId,
        bindingId,
        nextStatus
      };
    }

    revalidateWorkflowStudioPaths(workflowId);
    return {
      status: "success",
      message: buildWorkflowPublishLifecycleMutationSuccessMessage({
        endpointName: body?.endpoint_name,
        bindingId,
        lifecycleStatus: body?.lifecycle_status,
        nextStatus
      }),
      workflowId,
      bindingId,
      nextStatus
    };
  } catch {
    return {
      status: "error",
      message: buildWorkflowPublishLifecycleMutationNetworkErrorMessage(nextStatus),
      workflowId,
      bindingId,
      nextStatus
    };
  }
}

export async function createPublishedEndpointApiKey(
  _: CreatePublishedEndpointApiKeyState,
  formData: FormData
): Promise<CreatePublishedEndpointApiKeyState> {
  const workflowId = String(formData.get("workflowId") ?? "").trim();
  const bindingId = String(formData.get("bindingId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!workflowId || !bindingId || !name) {
    return {
      status: "error",
      message: buildWorkflowPublishApiKeyMutationValidationMessage("create"),
      workflowId,
      bindingId,
      name,
      secretKey: null,
      keyPrefix: null
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/workflows/${encodeURIComponent(
        workflowId
      )}/published-endpoints/${encodeURIComponent(bindingId)}/api-keys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name }),
        cache: "no-store"
      }
    );

    const body = (await response.json().catch(() => null)) as
      | { detail?: string; name?: string; key_prefix?: string; secret_key?: string }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? buildWorkflowPublishApiKeyMutationFallbackErrorMessage("create"),
        workflowId,
        bindingId,
        name,
        secretKey: null,
        keyPrefix: null
      };
    }

    revalidateWorkflowStudioPaths(workflowId);
    return {
      status: "success",
      message: buildWorkflowPublishApiKeyMutationSuccessMessage({
        action: "create",
        name: body?.name ?? name
      }),
      workflowId,
      bindingId,
      name: "",
      secretKey: body?.secret_key ?? null,
      keyPrefix: body?.key_prefix ?? null
    };
  } catch {
    return {
      status: "error",
      message: buildWorkflowPublishApiKeyMutationNetworkErrorMessage("create"),
      workflowId,
      bindingId,
      name,
      secretKey: null,
      keyPrefix: null
    };
  }
}

export async function cleanupLegacyPublishedEndpointBindings(
  _: CleanupLegacyPublishedEndpointBindingsState,
  formData: FormData
): Promise<CleanupLegacyPublishedEndpointBindingsState> {
  const workflowId = String(formData.get("workflowId") ?? "").trim();
  const bindingIds = formData
    .getAll("bindingId")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (!workflowId || bindingIds.length === 0) {
    return {
      status: "error",
      message: buildWorkflowPublishLegacyAuthCleanupValidationMessage(),
      workflowId,
      bindingIds
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/workflows/${encodeURIComponent(
        workflowId
      )}/published-endpoints/legacy-auth-cleanup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ binding_ids: bindingIds }),
        cache: "no-store"
      }
    );

    const body = (await response.json().catch(() => null)) as
      | ({ detail?: string } & Partial<WorkflowPublishedEndpointLegacyAuthCleanupResult>)
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? buildWorkflowPublishLegacyAuthCleanupFallbackErrorMessage(),
        workflowId,
        bindingIds
      };
    }

    revalidateWorkflowStudioPaths(workflowId);
    return {
      status: "success",
      message: buildWorkflowPublishLegacyAuthCleanupSuccessMessage({
        requested_count: body?.requested_count ?? bindingIds.length,
        updated_count: body?.updated_count ?? 0,
        skipped_count: body?.skipped_count ?? 0,
        updated_binding_ids: body?.updated_binding_ids ?? [],
        skipped_items: body?.skipped_items ?? []
      }),
      workflowId,
      bindingIds
    };
  } catch {
    return {
      status: "error",
      message: buildWorkflowPublishLegacyAuthCleanupNetworkErrorMessage(),
      workflowId,
      bindingIds
    };
  }
}

export async function revokePublishedEndpointApiKey(
  _: RevokePublishedEndpointApiKeyState,
  formData: FormData
): Promise<RevokePublishedEndpointApiKeyState> {
  const workflowId = String(formData.get("workflowId") ?? "").trim();
  const bindingId = String(formData.get("bindingId") ?? "").trim();
  const keyId = String(formData.get("keyId") ?? "").trim();
  const keyName = String(formData.get("keyName") ?? "").trim();

  if (!workflowId || !bindingId || !keyId) {
    return {
      status: "error",
      message: buildWorkflowPublishApiKeyMutationValidationMessage("revoke"),
      workflowId,
      bindingId,
      keyId
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/workflows/${encodeURIComponent(
        workflowId
      )}/published-endpoints/${encodeURIComponent(bindingId)}/api-keys/${encodeURIComponent(
        keyId
      )}`,
      {
        method: "DELETE",
        cache: "no-store"
      }
    );

    const body = (await response.json().catch(() => null)) as
      | { detail?: string; name?: string }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: body?.detail ?? buildWorkflowPublishApiKeyMutationFallbackErrorMessage("revoke"),
        workflowId,
        bindingId,
        keyId
      };
    }

    revalidateWorkflowStudioPaths(workflowId);
    return {
      status: "success",
      message: buildWorkflowPublishApiKeyMutationSuccessMessage({
        action: "revoke",
        name: body?.name ?? keyName,
        keyId
      }),
      workflowId,
      bindingId,
      keyId
    };
  } catch {
    return {
      status: "error",
      message: buildWorkflowPublishApiKeyMutationNetworkErrorMessage("revoke"),
      workflowId,
      bindingId,
      keyId
    };
  }
}
