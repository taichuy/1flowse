import type { RunCallbackTicketItem } from "@/lib/get-run-views";
import type { CallbackWaitingAutomationCheck } from "@/lib/get-system-overview";
import type { SensitiveAccessTimelineEntry } from "@/lib/get-sensitive-access";

export type CallbackWaitingSummaryProps = {
  inboxHref?: string | null;
  callbackTickets?: RunCallbackTicketItem[];
  callbackWaitingAutomation?: CallbackWaitingAutomationCheck | null;
  sensitiveAccessEntries?: SensitiveAccessTimelineEntry[];
  suppressSensitiveAccessContextRows?: boolean;
  showSensitiveAccessInlineActions?: boolean;
};
