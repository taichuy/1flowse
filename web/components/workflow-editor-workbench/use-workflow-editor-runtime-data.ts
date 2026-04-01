"use client";

import { useEffect, useState } from "react";

import { getCredentials, type CredentialItem } from "@/lib/get-credentials";
import {
  getWorkspaceModelProviderRegistry,
  type NativeModelProviderCatalogItem,
  type WorkspaceModelProviderConfigItem,
  type WorkspaceModelProviderRegistryStatus
} from "@/lib/model-provider-registry";
import { getWorkflowRuns, type WorkflowRunListItem } from "@/lib/get-workflow-runs";

type UseWorkflowEditorRuntimeDataOptions = {
  workflowId: string;
  initialCredentials?: CredentialItem[];
  initialModelProviderCatalog?: NativeModelProviderCatalogItem[];
  initialModelProviderConfigs?: WorkspaceModelProviderConfigItem[];
  initialModelProviderRegistryStatus?: WorkspaceModelProviderRegistryStatus;
  initialRecentRuns?: WorkflowRunListItem[];
  loadCredentials?: boolean;
  loadRecentRuns?: boolean;
};

type RuntimeDataState = {
  credentials: CredentialItem[];
  modelProviderCatalog: NativeModelProviderCatalogItem[];
  modelProviderConfigs: WorkspaceModelProviderConfigItem[];
  modelProviderRegistryStatus: WorkspaceModelProviderRegistryStatus;
  recentRuns: WorkflowRunListItem[];
};

type IdleCallbackHandle = number;
type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

function scheduleRuntimeDataLoad(callback: IdleCallback): IdleCallbackHandle {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(callback, { timeout: 1200 });
  }

  return window.setTimeout(
    () =>
      callback({
        didTimeout: false,
        timeRemaining: () => 0
      }),
    0
  );
}

function cancelRuntimeDataLoad(handle: IdleCallbackHandle) {
  if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle);
    return;
  }

  window.clearTimeout(handle);
}

export function useWorkflowEditorRuntimeData({
  workflowId,
  initialCredentials = [],
  initialModelProviderCatalog = [],
  initialModelProviderConfigs = [],
  initialModelProviderRegistryStatus = "idle",
  initialRecentRuns = [],
  loadCredentials = true,
  loadRecentRuns = true
}: UseWorkflowEditorRuntimeDataOptions): RuntimeDataState {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [modelProviderCatalog, setModelProviderCatalog] = useState<NativeModelProviderCatalogItem[]>(
    initialModelProviderCatalog
  );
  const [modelProviderConfigs, setModelProviderConfigs] = useState<
    WorkspaceModelProviderConfigItem[]
  >(initialModelProviderConfigs);
  const [modelProviderRegistryStatus, setModelProviderRegistryStatus] =
    useState<WorkspaceModelProviderRegistryStatus>(initialModelProviderRegistryStatus);
  const [recentRuns, setRecentRuns] = useState(initialRecentRuns);

  useEffect(() => {
    if (!loadCredentials) {
      return;
    }

    let active = true;
    setModelProviderRegistryStatus((currentStatus) =>
      currentStatus === "ready" ? currentStatus : "loading"
    );
    const handle = scheduleRuntimeDataLoad(() => {
      void getCredentials(true).then((nextCredentials) => {
        if (!active) {
          return;
        }

        setCredentials(nextCredentials);
      });

      void getWorkspaceModelProviderRegistry().then((registry) => {
        if (!active) {
          return;
        }

        if (!registry) {
          setModelProviderCatalog([]);
          setModelProviderConfigs([]);
          setModelProviderRegistryStatus("error");
          return;
        }

        setModelProviderCatalog(registry.catalog ?? []);
        setModelProviderConfigs(registry.items ?? []);
        setModelProviderRegistryStatus("ready");
      });
    });

    return () => {
      active = false;
      cancelRuntimeDataLoad(handle);
    };
  }, [loadCredentials]);

  useEffect(() => {
    if (!loadRecentRuns) {
      return;
    }

    let active = true;
    const handle = scheduleRuntimeDataLoad(() => {
      void getWorkflowRuns(workflowId).then((nextRecentRuns) => {
        if (!active) {
          return;
        }

        setRecentRuns(nextRecentRuns);
      });
    });

    return () => {
      active = false;
      cancelRuntimeDataLoad(handle);
    };
  }, [loadRecentRuns, workflowId]);

  return {
    credentials,
    modelProviderCatalog,
    modelProviderConfigs,
    modelProviderRegistryStatus,
    recentRuns
  };
}
