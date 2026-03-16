import Link from "next/link";

import { buildSensitiveAccessInboxHref } from "@/lib/sensitive-access-links";
import type { SensitiveAccessInboxPageFilterState } from "@/components/sensitive-access-inbox-page-shared";

type SensitiveAccessInboxFilterSectionProps<T extends string> = {
  title: string;
  allLabel: string;
  activeValue: T | null;
  options: readonly T[];
  filters: SensitiveAccessInboxPageFilterState;
  setFilter: (filters: SensitiveAccessInboxPageFilterState, value: T | null) => SensitiveAccessInboxPageFilterState;
};

export function SensitiveAccessInboxFilterSection<T extends string>({
  title,
  allLabel,
  activeValue,
  options,
  filters,
  setFilter
}: SensitiveAccessInboxFilterSectionProps<T>) {
  return (
    <div className="summary-strip">
      <Link
        className={`event-chip inbox-filter-link${activeValue === null ? " active" : ""}`}
        href={buildSensitiveAccessInboxHref(setFilter(filters, null))}
      >
        {allLabel}
      </Link>
      {options.map((option) => (
        <Link
          className={`event-chip inbox-filter-link${activeValue === option ? " active" : ""}`}
          href={buildSensitiveAccessInboxHref(setFilter(filters, option))}
          key={`${title}-${option}`}
        >
          {option}
        </Link>
      ))}
    </div>
  );
}
