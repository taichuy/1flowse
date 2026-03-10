"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { SyncAdapterToolsState } from "@/app/actions";

type AdapterSyncFormProps = {
  adapterId: string;
  action: (
    state: SyncAdapterToolsState,
    formData: FormData
  ) => Promise<SyncAdapterToolsState>;
};

function SyncSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="sync-button" type="submit" disabled={pending}>
      {pending ? "同步中..." : "同步工具目录"}
    </button>
  );
}

export function AdapterSyncForm({ adapterId, action }: AdapterSyncFormProps) {
  const initialState: SyncAdapterToolsState = {
    status: "idle",
    message: "",
    syncedCount: 0
  };
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="sync-form">
      <input type="hidden" name="adapterId" value={adapterId} />
      <SyncSubmitButton />
      {state.message ? (
        <p className={`sync-message ${state.status}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
