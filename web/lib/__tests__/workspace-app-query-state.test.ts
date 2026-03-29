import { describe, expect, it } from "vitest";

import {
  buildWorkspaceAppHref,
  buildWorkspaceAppSearchFormState,
  readWorkspaceAppViewState
} from "@/lib/workspace-app-query-state";

describe("workspace-app-query-state", () => {
  it("normalizes unknown query params back to workspace defaults", () => {
    expect(
      readWorkspaceAppViewState({
        filter: "bad-filter",
        mode: "nope",
        track: "unknown-track",
        keyword: ["  Agent ops  "]
      })
    ).toEqual({
      activeFilter: "all",
      activeMode: "all",
      activeTrack: "all",
      keyword: "Agent ops"
    });
  });

  it("builds compact workspace hrefs from non-default filters only", () => {
    expect(
      buildWorkspaceAppHref({
        activeFilter: "follow_up",
        activeMode: "agent",
        activeTrack: "应用新建编排",
        keyword: "  runtime  "
      })
    ).toBe(
      "/workspace?filter=follow_up&keyword=runtime&mode=agent&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92"
    );
    expect(buildWorkspaceAppHref({ activeFilter: "all", activeMode: "all", activeTrack: "all", keyword: "" })).toBe(
      "/workspace"
    );
  });

  it("keeps search form hidden state aligned with clear-href behavior", () => {
    expect(
      buildWorkspaceAppSearchFormState({
        activeFilter: "published",
        activeMode: "sandbox",
        activeTrack: "API 调用开放",
        keyword: "audit"
      })
    ).toEqual({
      filter: "published",
      mode: "sandbox",
      track: "API 调用开放",
      clearHref:
        "/workspace?filter=published&mode=sandbox&track=API+%E8%B0%83%E7%94%A8%E5%BC%80%E6%94%BE"
    });
  });
});
