import {
  WORKFLOW_BUSINESS_TRACKS,
  type WorkflowBusinessTrack
} from "@/lib/workflow-business-tracks";
import {
  isWorkspaceAppModeId,
  type WorkspaceAppModeId
} from "@/lib/workspace-app-modes";

export type WorkspaceFilterKey = "all" | "draft" | "published" | "follow_up";

export type WorkspaceAppViewState = {
  activeFilter: WorkspaceFilterKey;
  activeMode: WorkspaceAppModeId;
  activeTrack: WorkflowBusinessTrack | "all";
  keyword: string;
};

export type WorkspaceAppSearchFormState = {
  filter: string | null;
  mode: string | null;
  track: string | null;
  clearHref: string | null;
};

type WorkspaceAppSearchParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

const DEFAULT_WORKSPACE_APP_VIEW_STATE: WorkspaceAppViewState = {
  activeFilter: "all",
  activeMode: "all",
  activeTrack: "all",
  keyword: ""
};

export function readWorkspaceAppViewState(
  searchParams: WorkspaceAppSearchParamSource
): WorkspaceAppViewState {
  const requestedFilter = readFirstSearchValue(searchParams, "filter");
  const requestedMode = readFirstSearchValue(searchParams, "mode");
  const requestedTrack = readFirstSearchValue(searchParams, "track");
  const requestedKeyword = readFirstSearchValue(searchParams, "keyword")?.trim() ?? "";

  return {
    activeFilter:
      requestedFilter === "draft" ||
      requestedFilter === "published" ||
      requestedFilter === "follow_up"
        ? requestedFilter
        : DEFAULT_WORKSPACE_APP_VIEW_STATE.activeFilter,
    activeMode: requestedMode && isWorkspaceAppModeId(requestedMode)
      ? requestedMode
      : DEFAULT_WORKSPACE_APP_VIEW_STATE.activeMode,
    activeTrack:
      requestedTrack && WORKFLOW_BUSINESS_TRACKS.some((track) => track.id === requestedTrack)
        ? (requestedTrack as WorkflowBusinessTrack)
        : DEFAULT_WORKSPACE_APP_VIEW_STATE.activeTrack,
    keyword: requestedKeyword
  };
}

export function buildWorkspaceAppHref(viewState: Partial<WorkspaceAppViewState>) {
  const searchParams = new URLSearchParams();

  if (viewState.activeFilter && viewState.activeFilter !== "all") {
    searchParams.set("filter", viewState.activeFilter);
  }

  if (viewState.activeMode && viewState.activeMode !== "all") {
    searchParams.set("mode", viewState.activeMode);
  }

  if (viewState.activeTrack && viewState.activeTrack !== "all") {
    searchParams.set("track", viewState.activeTrack);
  }

  if (viewState.keyword && viewState.keyword.trim()) {
    searchParams.set("keyword", viewState.keyword.trim());
  }

  searchParams.sort();
  const query = searchParams.toString();
  return query ? `/workspace?${query}` : "/workspace";
}

export function buildWorkspaceAppSearchFormState(
  viewState: WorkspaceAppViewState
): WorkspaceAppSearchFormState {
  return {
    filter: viewState.activeFilter === "all" ? null : viewState.activeFilter,
    mode: viewState.activeMode === "all" ? null : viewState.activeMode,
    track: viewState.activeTrack === "all" ? null : viewState.activeTrack,
    clearHref: viewState.keyword
      ? buildWorkspaceAppHref({
          activeFilter: viewState.activeFilter,
          activeMode: viewState.activeMode,
          activeTrack: viewState.activeTrack
        })
      : null
  };
}

function readFirstSearchValue(
  searchParams: WorkspaceAppSearchParamSource,
  key: string
) {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key);
  }

  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
