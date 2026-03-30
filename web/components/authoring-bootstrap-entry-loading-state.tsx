import { AuthoringSurfaceLoadingState } from "@/components/authoring-surface-loading-state";
import type { AuthoringBootstrapLoadingSurfaceCopy } from "@/lib/workbench-entry-surfaces";

type AuthoringBootstrapEntryLoadingStateProps = {
  surfaceCopy: AuthoringBootstrapLoadingSurfaceCopy;
};

export function AuthoringBootstrapEntryLoadingState({
  surfaceCopy
}: AuthoringBootstrapEntryLoadingStateProps) {
  return <AuthoringSurfaceLoadingState {...surfaceCopy} />;
}
