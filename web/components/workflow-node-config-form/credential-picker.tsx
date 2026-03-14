"use client";

import { useCallback, useEffect, useState } from "react";

type CredentialOption = {
  id: string;
  name: string;
  credential_type: string;
};

type CredentialPickerProps = {
  /** Current value — may be "credential://{id}" or a plain string. */
  value: string;
  /** Called when the user picks a credential or clears the selection. */
  onChange: (nextValue: string | undefined) => void;
  /** Label shown above the picker. */
  label: string;
  /** Optional hint text below the picker. */
  hint?: string;
  /** Optional filter — only show credentials of this type. */
  credentialType?: string;
  /** Placeholder when nothing is selected. */
  placeholder?: string;
};

const CREDENTIAL_PREFIX = "credential://";

function parseCredentialRef(value: string): string | null {
  if (typeof value === "string" && value.startsWith(CREDENTIAL_PREFIX)) {
    const id = value.slice(CREDENTIAL_PREFIX.length).trim();
    return id || null;
  }
  return null;
}

export function CredentialPicker({
  value,
  onChange,
  label,
  hint,
  credentialType,
  placeholder = "选择凭证"
}: CredentialPickerProps) {
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const apiBase =
          typeof window !== "undefined"
            ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
            : "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/credentials`, {
          cache: "no-store"
        });
        if (!res.ok) {
          setCredentials([]);
          return;
        }
        const items = (await res.json()) as CredentialOption[];
        if (!cancelled) {
          setCredentials(items);
        }
      } catch {
        if (!cancelled) {
          setCredentials([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCredentials = credentialType
    ? credentials.filter((c) => c.credential_type === credentialType)
    : credentials;

  const currentCredId = parseCredentialRef(value);
  const currentCredName = currentCredId
    ? filteredCredentials.find((c) => c.id === currentCredId)?.name ?? currentCredId
    : null;

  const handleSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = event.target.value;
      if (!selectedId) {
        onChange(undefined);
      } else {
        onChange(`${CREDENTIAL_PREFIX}${selectedId}`);
      }
    },
    [onChange]
  );

  return (
    <div className="binding-field">
      <span className="binding-label">{label}</span>
      {loading ? (
        <span className="section-copy">加载凭证列表...</span>
      ) : filteredCredentials.length === 0 ? (
        <span className="section-copy">
          暂无可用凭证，请先在首页凭证管理面板中创建。
        </span>
      ) : (
        <select
          className="binding-select"
          value={currentCredId ?? ""}
          onChange={handleSelect}
        >
          <option value="">{placeholder}</option>
          {filteredCredentials.map((cred) => (
            <option key={cred.id} value={cred.id}>
              {cred.name} ({cred.credential_type})
            </option>
          ))}
        </select>
      )}
      {currentCredName && !currentCredId ? null : null}
      {value && !currentCredId && value !== "" ? (
        <small className="section-copy">
          当前值 <code>{value}</code> 不是 credential:// 引用，将作为明文传递。
        </small>
      ) : null}
      {hint ? <small className="section-copy">{hint}</small> : null}
    </div>
  );
}
