import { describe, expect, it } from "vitest";

import { runWorkflowEditorPendingMutation } from "@/components/workflow-editor-workbench/use-workflow-editor-persistence";

describe("runWorkflowEditorPendingMutation", () => {
  const recordPendingState = (
    states: boolean[]
  ) => (next: boolean | ((previousState: boolean) => boolean)) => {
    const previous = states.at(-1) ?? false;
    states.push(typeof next === "function" ? next(previous) : next);
  };

  it("resets pending after a successful mutation", async () => {
    const pendingStates: boolean[] = [];

    await runWorkflowEditorPendingMutation(
      recordPendingState(pendingStates),
      async () => {
        await Promise.resolve();
      }
    );

    expect(pendingStates).toEqual([true, false]);
  });

  it("resets pending after a failed mutation", async () => {
    const pendingStates: boolean[] = [];
    const error = new Error("save failed");

    await expect(
      runWorkflowEditorPendingMutation(
        recordPendingState(pendingStates),
        async () => {
          throw error;
        }
      )
    ).rejects.toThrow("save failed");

    expect(pendingStates).toEqual([true, false]);
  });
});
