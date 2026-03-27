import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import type { WorkflowValidationNavigatorItem } from "@/lib/workflow-validation-navigation";
import {
  buildWorkflowValidationRemediation,
  pickWorkflowValidationRemediationItem
} from "@/lib/workflow-validation-remediation";

type BuildWorkflowPersistBlockedFeedbackMessageOptions = {
  persistBlockerSummary?: string | null;
  persistBlockedMessage: string;
  validationNavigatorItems: WorkflowValidationNavigatorItem[];
  sandboxReadiness?: SandboxReadinessCheck | null;
};

export function buildWorkflowPersistBlockedFeedbackMessage({
  persistBlockerSummary = null,
  persistBlockedMessage,
  validationNavigatorItems,
  sandboxReadiness = null
}: BuildWorkflowPersistBlockedFeedbackMessageOptions) {
  const remediationItem = pickWorkflowValidationRemediationItem(validationNavigatorItems);

  if (!remediationItem) {
    return persistBlockerSummary
      ? `${persistBlockerSummary} 已定位到首个阻断点。`
      : persistBlockedMessage;
  }

  const remediation = buildWorkflowValidationRemediation(remediationItem, sandboxReadiness);

  return [persistBlockerSummary, `已定位到 ${remediation.title}。${remediation.suggestion}`]
    .filter(Boolean)
    .join(" ");
}
